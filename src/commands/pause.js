import { SlashCommandBuilder } from 'discord.js';
import { getState } from '../music/queue.js';

export const data = new SlashCommandBuilder()
  .setName('pause')
  .setDescription('Pause playback.');

export async function execute(interaction) {
  const state = getState(interaction.guildId);
  if (!state || !state.current) {
    return interaction.reply({ content: 'Nothing is playing.', ephemeral: true });
  }

  const success = state.player.pause();
  if (!success) {
    return interaction.reply({ content: 'Unable to pause playback right now.', ephemeral: true });
  }

  return interaction.reply('⏸️ Paused.');
}
