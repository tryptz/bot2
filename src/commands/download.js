import { SlashCommandBuilder, AttachmentBuilder, EmbedBuilder } from 'discord.js';
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

function imageExtensionFromContentType(type) {
  if (!type) return 'jpg';
  const normalized = type.split(';')[0].trim().toLowerCase();
  if (normalized.includes('png')) return 'png';
  if (normalized.includes('webp')) return 'webp';
  if (normalized.includes('gif')) return 'gif';
  if (normalized.includes('jpeg') || normalized.includes('jpg')) return 'jpg';
  return 'jpg';
}

function extensionFromUrl(url) {
  const parsed = path.extname(new URL(url).pathname).split('.').pop();
  if (!parsed) return null;
  const cleaned = parsed.toLowerCase();
  if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(cleaned)) return cleaned === 'jpeg' ? 'jpg' : cleaned;
  return null;
}

async function downloadImage(url, dest) {
  const res = await fetch(url);
  if (!res.ok || !res.body) return false;
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
  return true;
}

export async function execute(interaction) {
  await interaction.deferReply();

  const quality = interaction.options.getString('quality') || config.trypthifi.defaultQuality;
  let track;
  try {
    const results = await searchTracks(interaction.options.getString('query'));
    if (results.length === 0) return interaction.editReply('🔍 No matching tracks found.');
    track = results[0];

    const url = await getStreamUrl(track.id, quality);
    const res = await fetch(url);
    if (!res.ok || !res.body) throw new Error(`Fetch failed (HTTP ${res.status}).`);

    const ext = quality === '5' ? 'mp3' : 'flac';
    await mkdir(config.downloadDir, { recursive: true });
    const file = path.join(config.downloadDir, `${safeName(`${track.artist} - ${track.title}`)}.${ext}`);
    await pipeline(Readable.fromWeb(res.body), createWriteStream(file));

    let artFilePath = null;
    if (track.artUrl) {
      const imageExt = extensionFromUrl(track.artUrl) || imageExtensionFromContentType(res.headers.get('content-type'));
      artFilePath = path.join(config.downloadDir, `${safeName(`${track.artist} - ${track.title} cover`)}.${imageExt}`);
      try {
        const ok = await downloadImage(track.artUrl, artFilePath);
        if (!ok) artFilePath = null;
      } catch {
        artFilePath = null;
      }
    }

    const summary = `✅ Saved **${track.title}** — ${track.artist} \`${formatDuration(track.durationSec)}\``;
    const embed = new EmbedBuilder()
      .setTitle(track.title)
      .setAuthor({ name: track.artist })
      .setDescription(summary)
      .setFooter({ text: `Quality ${quality}` });

    if (track.album) embed.addFields({ name: 'Album', value: track.album, inline: true });
    if (artFilePath) {
      embed.setImage(`attachment://${path.basename(artFilePath)}`);
      embed.setThumbnail(`attachment://${path.basename(artFilePath)}`);
    }

    const NITRO_LIMIT = 500 * 1024 * 1024;
    const { size } = await stat(file);
    const files = [];
    const audioAttachment = new AttachmentBuilder(file);
    files.push(audioAttachment);
    if (artFilePath) files.push(new AttachmentBuilder(artFilePath));

    const payload = { embeds: [embed], files };

    if (size <= NITRO_LIMIT) {
      return interaction.editReply(payload);
    }

    payload.files = artFilePath ? [new AttachmentBuilder(artFilePath)] : [];
    payload.content = `${summary}\n⚠️ Too large to upload (${(size / 1048576).toFixed(1)} MB). Saved to \`${file}\` on the bot machine.`;
    return interaction.editReply(payload);
  } catch (err) {
    return interaction.editReply(`❌ ${err.message}`);
  }
}
