// Loads and validates environment variables once, so the rest of the code can
// import a clean `config` object instead of reaching into process.env everywhere.
import 'dotenv/config';

function required(name) {
  const value = process.env[name];
  if (!value || value.startsWith('your-')) {
    throw new Error(
      `Missing env var ${name}. Copy .env.example to .env and fill it in.`
    );
  }
  return value;
}

export const config = {
  token: required('DISCORD_TOKEN'),
  clientId: required('CLIENT_ID'),
  // GUILD_ID is optional: present = instant guild commands, absent = global.
  guildId: process.env.GUILD_ID && !process.env.GUILD_ID.startsWith('your-')
    ? process.env.GUILD_ID
    : null,

  trypthifi: {
    baseUrl: (process.env.TRYPT_HIFI_URL || 'https://tryptify.lol').replace(/\/$/, ''),
    country: process.env.TRYPT_HIFI_COUNTRY || '',
    defaultQuality: process.env.DEFAULT_QUALITY || '6',
  },

  downloadDir: process.env.DOWNLOAD_DIR || 'downloads',
};
