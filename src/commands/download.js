import { SlashCommandBuilder, AttachmentBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { searchTracks, getStreamUrl, formatDuration } from '../trypthifi.js';
import { config } from '../config.js';
import { Readable } from 'node:stream';
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, stat, rm } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';

export const data = new SlashCommandBuilder()
  .setName('download')
  .setDescription('Download a track from TrypT-hifi to the bot machine.')
  .addStringOption((o) =>
    o.setName('query').setDescription('Song / artist to search for').setRequired(true))
  .addStringOption((o) =>
    o.setName('quality').setDescription('Audio quality').addChoices(
      { name: 'Hi-Res 192kHz', value: '27' },
      { name: 'Hi-Res 96kHz', value: '7' },
      { name: 'CD Lossless', value: '6' },
      { name: 'MP3 320', value: '5' },
    ));

// Strip characters Windows/most filesystems reject.
function safeName(s) {
  return s.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 150);
}

// A bot's per-message upload cap is set by whoever ran the command (their Nitro)
// plus the server's Boost tier — not the bot. When a file exceeds it, Discord
// rejects the request with HTTP 413 / API error code 40005.
function isEntityTooLarge(err) {
  return err?.status === 413 || err?.code === 40005 || /entity too large/i.test(err?.message ?? '');
}

// Transcode any audio file to Opus at the given bitrate. Lazily imports
// ffmpeg-static so a missing binary can't break command loading — the caller
// treats any rejection as "fall back to the link".
async function transcodeToOpus(input, output, kbps) {
  const mod = await import('ffmpeg-static');
  const ffmpegPath = mod.default || mod;
  if (!ffmpegPath) throw new Error('ffmpeg binary unavailable');
  await new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, ['-y', '-i', input, '-vn', '-c:a', 'libopus', '-b:a', `${kbps}k`, output], {
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let stderr = '';
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('error', reject);
    proc.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-200)}`))));
  });
  return output;
}

// Send a reply; returns false if Discord rejected the attachment as too large
// (413) so the caller can try a smaller fallback. Re-throws anything else.
async function trySend(interaction, payload) {
  try {
    await interaction.editReply(payload);
    return true;
  } catch (err) {
    if (isEntityTooLarge(err)) return false;
    throw err;
  }
}

export async function execute(interaction) {
  await interaction.deferReply();

  const quality = interaction.options.getString('quality') || config.trypthifi.defaultQuality;
  try {
    const results = await searchTracks(interaction.options.getString('query'));
    if (results.length === 0) return interaction.editReply('🔍 No matching tracks found.');
    const track = results[0];

    const url = await getStreamUrl(track.id, quality);
    const res = await fetch(url);
    if (!res.ok || !res.body) throw new Error(`Fetch failed (HTTP ${res.status}).`);

    const ext = quality === '5' ? 'mp3' : 'flac';
    await mkdir(config.downloadDir, { recursive: true });
    const baseName = safeName(`${track.artist} - ${track.title}`);
    const file = path.join(config.downloadDir, `${baseName}.${ext}`);
    await pipeline(Readable.fromWeb(res.body), createWriteStream(file));

    const summary = `✅ Saved **${track.title}** — ${track.artist} \`${formatDuration(track.durationSec)}\``;
    const embed = new EmbedBuilder()
      .setTitle(track.title)
      .setAuthor({ name: track.artist })
      .setDescription(summary)
      .setFooter({ text: `Quality ${quality}` });
    if (track.album) embed.addFields({ name: 'Album', value: track.album, inline: true });
    // Album art: point the embed at the remote cover URL and let Discord fetch it
    // (attachment:// breaks on filenames with spaces, so it stayed blank before).
    if (track.artUrl) embed.setImage(track.artUrl);

    const linkButton = () =>
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel(`Original (${ext.toUpperCase()})`).setStyle(ButtonStyle.Link).setURL(url).setEmoji('⬇️'),
      );

    const { size } = await stat(file);

    // 1) Full-quality file — works for whoever's upload cap covers it (Nitro
    //    users, boosted servers, small files). The cap is per-invoker, so a 413
    //    here just drops us to the Opus fallback below.
    if (size <= config.maxUploadBytes) {
      if (await trySend(interaction, { embeds: [embed], files: [new AttachmentBuilder(file)] })) return;
    }

    // 2) Too large to upload (e.g. a non-Nitro user's 10 MB cap). Transcode to
    //    Opus (~256 kbps: perceptually lossless but a fraction of the size) and
    //    send that instead, with the lossless original still one click away.
    const opusFile = path.join(config.downloadDir, `${baseName}.opus`);
    try {
      await transcodeToOpus(file, opusFile, config.opusFallbackKbps);
      const { size: opusSize } = await stat(opusFile);
      if (opusSize <= config.maxUploadBytes) {
        const note = `${summary}\n🎧 Full file was too large to upload here — sent as **Opus ${config.opusFallbackKbps} kbps** (${(opusSize / 1048576).toFixed(1)} MB). Lossless original below (link valid ~15 min).`;
        const sent = await trySend(interaction, {
          content: note,
          embeds: [embed],
          files: [new AttachmentBuilder(opusFile)],
          components: [linkButton()],
        });
        if (sent) return;
      }
    } catch (err) {
      console.error('Opus fallback failed:', err.message);
    } finally {
      await rm(opusFile, { force: true }).catch(() => {});
    }

    // 3) Even Opus wouldn't fit (or transcode failed) — hand back the link only.
    return interaction.editReply({
      content: `${summary}\n⚠️ Too large to upload here — download it directly (link valid ~15 min):`,
      embeds: [embed],
      components: [linkButton()],
    });
  } catch (err) {
    return interaction.editReply(`❌ ${err.message}`);
  }
}
