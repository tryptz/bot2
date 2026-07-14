import { SlashCommandBuilder } from 'discord.js';
import { getState } from '../music/queue.js';

export const data = new SlashCommandBuilder()
  .setName('clear')
  .setDescription('Clear the current queue.');

export async function execute(interaction) {
  const state = getState(interaction.guildId);
  if (!state) {
    return interaction.reply({ content: 'No active queue.', ephemeral: true });
  }

  state.queue = [];
  return interaction.reply('🧹 Queue cleared.');
}
