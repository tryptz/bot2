// Main entrypoint: logs in, loads every command in ./commands, and routes
// incoming slash-command interactions to the matching command's execute().
import { Client, GatewayIntentBits, Collection, Events } from 'discord.js';
import { readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { config } from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// GuildVoiceStates is required for the bot to see/join voice channels.
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

// Dynamically import each command file and index it by command name.
client.commands = new Collection();
const commandsDir = path.join(__dirname, 'commands');
for (const fileName of readdirSync(commandsDir).filter((f) => f.endsWith('.js'))) {
  const mod = await import(pathToFileURL(path.join(commandsDir, fileName)).href);
  if (mod?.data?.name && typeof mod.execute === 'function') {
    client.commands.set(mod.data.name, mod);
  } else {
    console.warn(`Skipping ${fileName}: missing "data" or "execute" export.`);
  }
}

client.once(Events.ClientReady, (c) => {
  console.log(`✅ Logged in as ${c.user.tag}. ${client.commands.size} commands loaded.`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(`Error in /${interaction.commandName}:`, err);
    const msg = { content: `❌ Something went wrong: ${err.message}`, ephemeral: true };
    if (interaction.deferred || interaction.replied) await interaction.followUp(msg).catch(() => {});
    else await interaction.reply(msg).catch(() => {});
  }
});

client.login(config.token);
