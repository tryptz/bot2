import { SlashCommandBuilder } from 'discord.js';
import { searchTracks, formatDuration } from '../trypthifi.js';
import { ensureVoice, enqueue, getState } from '../music/queue.js';
import { config } from '../config.js';

export const data = new SlashCommandBuilder()
  .setName('play')
  .setDescription('Search TrypT-hifi and play a track in your voice channel.')
  .addStringOption((o) =>
    o.setName('query').setDescription('Song / artist to search for').setRequired(true))
  .addStringOption((o) =>
    o.setName('quality').setDescription('Audio quality').addChoices(
      { name: 'Hi-Res 192kHz', value: '27' },
      { name: 'Hi-Res 96kHz', value: '7' },
      { name: 'CD Lossless', value: '6' },
      { name: 'MP3 320', value: '5' },
    ));

export async function execute(interaction) {
  // The user must be in a voice channel so we know where to join.
  const voiceChannel = interaction.member?.voice?.channel;
  if (!voiceChannel) {
    return interaction.reply({ content: '🔇 Join a voice channel first, then run /play.', ephemeral: true });
  }

  await interaction.deferReply(); // searching may take a moment

  let results;
  try {
    results = await searchTracks(interaction.options.getString('query'));
  } catch (err) {
    return interaction.editReply(`❌ ${err.message}`);
  }
  if (results.length === 0) return interaction.editReply('🔍 No matching tracks found.');

  const track = results[0];
  track.quality = interaction.options.getString('quality') || config.trypthifi.defaultQuality;

  ensureVoice(voiceChannel, interaction.channel);
  const wasIdle = !getState(voiceChannel.guild.id)?.current;
  try {
    await enqueue(voiceChannel.guild.id, track);
  } catch (err) {
    return interaction.editReply(`❌ ${err.message}`);
  }

  const line = `**${track.title}** — ${track.artist} \`${formatDuration(track.durationSec)}\``;
  return interaction.editReply(wasIdle ? `▶️ Playing ${line}` : `➕ Queued ${line}`);
}
