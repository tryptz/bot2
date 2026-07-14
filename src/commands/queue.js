import { SlashCommandBuilder } from 'discord.js';
import { getState } from '../music/queue.js';
import { formatDuration } from '../trypthifi.js';

export const data = new SlashCommandBuilder()
  .setName('queue')
  .setDescription('Show what is playing and what is up next.');

export async function execute(interaction) {
  const state = getState(interaction.guildId);
  if (!state || (!state.current && state.queue.length === 0)) {
    return interaction.reply({ content: 'The queue is empty.', ephemeral: true });
  }

  const lines = [];
  if (state.current) {
    lines.push(`**Now playing:** ${state.current.title} — ${state.current.artist}`);
  }
  if (state.queue.length) {
    lines.push('', '**Up next:**');
    state.queue.slice(0, 10).forEach((t, i) => {
      lines.push(`${i + 1}. ${t.title} — ${t.artist} \`${formatDuration(t.durationSec)}\``);
    });
    if (state.queue.length > 10) lines.push(`…and ${state.queue.length - 10} more.`);
  }
  return interaction.reply(lines.join('\n'));
}
