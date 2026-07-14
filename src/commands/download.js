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

    const summary = `✅ Saved **${track.title}** — ${track.artist} \`${formatDuration(track.durationSec)}\``;
    const embed = new EmbedBuilder()
      .setTitle(track.title)
      .setAuthor({ name: track.artist })
      .setDescription(summary)
      .setFooter({ text: `Quality ${quality}` });

    if (track.album) embed.addFields({ name: 'Album', value: track.album, inline: true });
    if (track.artUrl) embed.setImage(track.artUrl);

    const NITRO_LIMIT = 500 * 1024 * 1024;
    const { size } = await stat(file);
    const payload = { embeds: [embed] };

    if (size <= NITRO_LIMIT) {
      payload.files = [new AttachmentBuilder(file)];
      return interaction.editReply(payload);
    }

    payload.content = `${summary}\n⚠️ Too large to upload (${(size / 1048576).toFixed(1)} MB). Saved to \`${file}\` on the bot machine.`;
    return interaction.editReply(payload);
  } catch (err) {
    return interaction.editReply(`❌ ${err.message}`);
  }
}
