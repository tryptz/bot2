# Discord Developer Portal — one-time setup

You do these steps yourself (they involve your bot token, which is a password —
I never handle it). Takes about 3 minutes. You already have the portal open in Edge.

## 1. Create the application
1. Go to <https://discord.com/developers/applications>.
2. Click **New Application**, name it **Tryptify**, agree, **Create**.
3. On **General Information**, copy the **Application ID** → this is your `CLIENT_ID`.

## 2. Turn it into a bot
1. Left sidebar → **Bot**.
2. Click **Reset Token** → **Yes, do it** → **Copy**. This is your `DISCORD_TOKEN`.
   - Treat it like a password. If it ever leaks, click Reset Token again to invalidate it.
3. Scroll to **Privileged Gateway Intents**. For music playback you do **not**
   need any of them on — leave Presence / Server Members / Message Content **off**.

## 3. Invite the bot to your server
1. Left sidebar → **OAuth2** → **URL Generator**.
2. Under **Scopes**, check **`bot`** and **`applications.commands`**.
3. Under **Bot Permissions**, check:
   - **View Channels**
   - **Send Messages**
   - **Connect** (voice)
   - **Speak** (voice)
4. Copy the generated URL at the bottom, open it, pick your server, **Authorize**.

## 4. Get your server ID (for instant commands)
1. In Discord: **User Settings → Advanced → Developer Mode: ON**.
2. Right-click your server icon → **Copy Server ID** → this is your `GUILD_ID`.

## 5. Fill in the bot's .env
In the `tryptify-bot` folder, copy `.env.example` to `.env` and paste in your
`DISCORD_TOKEN`, `CLIENT_ID`, and `GUILD_ID`. Then see `README.md` to run it.
