import { SlashCommandBuilder, AttachmentBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { searchTracks, getStreamUrl, formatDuration } from '../trypthifi.js';
import { config } from '../config.js';
import { Readable } from 'node:stream';
import { createWriteStream } from 'node:fs';
import { mkdir, stat } from 'node:fs/promises';
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

// A bot's upload limit is set by the server's Boost tier (25/50/100 MB), not by
// anyone's Nitro. When a file exceeds it, Discord rejects the request with
// HTTP 413 / API error code 40005 ("Request entity too large").
function isEntityTooLarge(err) {
  return err?.status === 413 || err?.code === 40005 || /entity too large/i.test(err?.message ?? '');
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
    const file = path.join(config.downloadDir, `${safeName(`${track.artist} - ${track.title}`)}.${ext}`);
    await pipeline(Readable.fromWeb(res.body), createWriteStream(file));

    const summary = `✅ Saved **${track.title}** — ${track.artist} \`${formatDuration(track.durationSec)}\``;
    const embed = new EmbedBuilder()
      .setTitle(track.title)
      .setAuthor({ name: track.artist })
      .setDescription(summary)
      .setFooter({ text: `Quality ${quality}` });

    if (track.album) embed.addFields({ name: 'Album', value: track.album, inline: true });
    // Album art: point the embed at the remote cover URL and let Discord fetch it.
    // attachment:// breaks because Discord sanitizes filenames with spaces.
    if (track.artUrl) embed.setImage(track.artUrl);

    const { size } = await stat(file);

    // Attach the file directly when it's within the upload limit. The real cap is
    // the server's Boost tier, so we also catch a 413 at send time and fall back
    // to the download link below — no matter which server ran the command.
    if (size <= config.maxUploadBytes) {
      try {
        return await interaction.editReply({ embeds: [embed], files: [new AttachmentBuilder(file)] });
      } catch (err) {
        if (!isEntityTooLarge(err)) throw err;
      }
    }

    // Too large to upload here — hand back the signed download link instead
    // (valid ~15 min), which works regardless of the server's upload limit.
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setLabel('Download').setStyle(ButtonStyle.Link).setURL(url).setEmoji('⬇️'),
    );
    return interaction.editReply({
      content: `${summary}\n⚠️ ${(size / 1048576).toFixed(1)} MB is too large to upload here — download it directly (link valid ~15 min):`,
      embeds: [embed],
      components: [row],
    });
  } catch (err) {
    return interaction.editReply(`❌ ${err.message}`);
  }
}
