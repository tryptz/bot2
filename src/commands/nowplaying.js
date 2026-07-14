import { SlashCommandBuilder } from 'discord.js';
import { getState } from '../music/queue.js';
import { formatDuration } from '../trypthifi.js';

export const data = new SlashCommandBuilder()
  .setName('nowplaying')
  .setDescription('Show the currently playing track.');

export async function execute(interaction) {
  const state = getState(interaction.guildId);
  if (!state || !state.current) {
    return interaction.reply({ content: 'Nothing is playing right now.', ephemeral: true });
  }

  const current = state.current;
  const queued = state.queue.length;
  const lines = [
    `▶️ **Now playing:** ${current.title} — ${current.artist}`,
    `• Duration: ${formatDuration(current.durationSec)}`,
  ];
  if (current.album) lines.push(`• Album: ${current.album}`);
  if (queued) lines.push(`• Up next: ${queued} track${queued === 1 ? '' : 's'}`);

  return interaction.reply(lines.join('\n'));
}
