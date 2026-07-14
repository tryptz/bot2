import { SlashCommandBuilder } from 'discord.js';
import { skip } from '../music/queue.js';

export const data = new SlashCommandBuilder()
  .setName('skip')
  .setDescription('Skip the current track.');

export async function execute(interaction) {
  const ok = skip(interaction.guildId);
  return interaction.reply(ok ? '⏭️ Skipped.' : 'Nothing is playing.');
}
