# Tryptify — Discord music bot

A Discord bot that searches, plays (in voice channels), and downloads music by
talking to a self-hosted **TrypT-hifi** (Qobuz-DL) backend. Built with
`discord.js` v14 and `@discordjs/voice`.

## Commands
| Command | What it does |
| --- | --- |
| `/ping` | Health check. |
| `/play query:<text> [quality]` | Search the backend and play the top hit in your voice channel (queues if something's already playing). |
| `/skip` | Skip the current track. |
| `/queue` | Show now-playing + up next. |
| `/stop` | Stop, clear the queue, leave the channel. |
| `/download query:<text> [quality]` | Save the top hit to the bot machine's `downloads/` folder. |

Quality values: `27` Hi-Res 192k · `7` Hi-Res 96k · `6` CD lossless · `5` MP3 320.

## Setup
1. **Discord app + token:** follow `SETUP-DISCORD-PORTAL.md`.
2. **Configure:** `copy .env.example .env` and fill in `DISCORD_TOKEN`,
   `CLIENT_ID`, `GUILD_ID`. `TRYPT_HIFI_URL` defaults to `https://tryptify.lol`.
3. **Install:** `npm install` (already done if you scaffolded via the assistant).
4. **Register commands:** `npm run deploy` (instant for your guild).
5. **Run:** `npm start`. You should see `✅ Logged in as Tryptify#...`.

## How it works
- `src/trypthifi.js` calls the backend's existing `GET /api/get-music` (search)
  and `GET /api/download-music` (signed CDN URL) routes.
- `src/music/queue.js` keeps one voice connection + audio player per server and
  streams the fetched URL through ffmpeg (bundled via `ffmpeg-static`) into Opus.
- `src/index.js` auto-loads every file in `src/commands/` — add a command by
  dropping in a new file that exports `data` and `execute`.

## Requirements
- Node 18+ (you have 24). ffmpeg is bundled — no system install needed.

## A note on the backend
This bot is a front-end for **your own** TrypT-hifi instance and **your own**
Qobuz token. Qobuz content is copyrighted; downloading is meant for the token
owner's personal use. Redistributing downloaded files or streaming them to a
public server can infringe copyright and Qobuz's terms — keep it to your own use.
