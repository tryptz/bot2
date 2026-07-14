import { SlashCommandBuilder } from 'discord.js';
import { getState } from '../music/queue.js';

export const data = new SlashCommandBuilder()
  .setName('resume')
  .setDescription('Resume paused playback.');

export async function execute(interaction) {
  const state = getState(interaction.guildId);
  if (!state || !state.current) {
    return interaction.reply({ content: 'Nothing is paused.', ephemeral: true });
  }

  const success = state.player.unpause();
  if (!success) {
    return interaction.reply({ content: 'Unable to resume playback right now.', ephemeral: true });
  }

  return interaction.reply('▶️ Resumed.');
}
