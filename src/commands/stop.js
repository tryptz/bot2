import { SlashCommandBuilder } from 'discord.js';
import { destroy, getState } from '../music/queue.js';

export const data = new SlashCommandBuilder()
  .setName('stop')
  .setDescription('Stop playback, clear the queue, and leave the channel.');

export async function execute(interaction) {
  if (!getState(interaction.guildId)) {
    return interaction.reply({ content: 'Not connected.', ephemeral: true });
  }
  destroy(interaction.guildId);
  return interaction.reply('⏹️ Stopped and left the channel.');
}
