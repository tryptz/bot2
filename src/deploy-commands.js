// Registers slash commands with Discord. Run this once (and again whenever you
// add/change a command's name, description, or options): `npm run deploy`.
// Guild-scoped registration (GUILD_ID set) appears instantly; global takes ~1h.
import { REST, Routes } from 'discord.js';
import { readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { config } from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const body = [];
const commandsDir = path.join(__dirname, 'commands');
for (const fileName of readdirSync(commandsDir).filter((f) => f.endsWith('.js'))) {
  const mod = await import(pathToFileURL(path.join(commandsDir, fileName)).href);
  if (mod?.data) body.push(mod.data.toJSON());
}

const rest = new REST().setToken(config.token);

try {
  const route = config.guildId
    ? Routes.applicationGuildCommands(config.clientId, config.guildId)
    : Routes.applicationCommands(config.clientId);
  const data = await rest.put(route, { body });
  console.log(`✅ Registered ${data.length} commands ${config.guildId ? `to guild ${config.guildId}` : 'globally'}.`);
} catch (err) {
  console.error('Failed to register commands:', err);
  process.exit(1);
}
