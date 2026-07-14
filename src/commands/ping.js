// Simplest possible command: proves the bot is online and commands are wired.
import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('Check that Tryptify is alive.');

export async function execute(interaction) {
  const sent = await interaction.reply({ content: 'Pinging…', fetchReply: true });
  const latency = sent.createdTimestamp - interaction.createdTimestamp;
  await interaction.editReply(`🏓 Pong! Round-trip ${latency}ms, gateway ${Math.round(interaction.client.ws.ping)}ms.`);
}
