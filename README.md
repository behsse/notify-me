# notify-me

Discord bot that watches YouTube channels, Twitch streamers, and TikTok accounts, then posts an announcement in the right channel as soon as something new drops.

- **YouTube** — new videos *and* Shorts (via the public RSS feed, no API key needed).
- **Twitch** — live stream starts (via the Helix API).
- **TikTok** — new posts (via a RSSHub instance you self-host).

Everything is configured from Discord with slash commands. Per-platform Discord channel routing, optional role pings, and per-guild subscriptions are all stored in a local SQLite database.

---

## Stack

- Node.js 20 + TypeScript (ESM)
- [discord.js](https://discord.js.org) v14
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) for local storage
- [rss-parser](https://github.com/rbren/rss-parser) for YouTube + RSSHub feeds
- [node-cron](https://github.com/node-cron/node-cron) for scheduling
- Docker for deployment (Railway, Hostinger VPS, or anywhere)

---

## Slash commands

| Command | What it does |
|---|---|
| `/setchannel platform:<youtube\|twitch\|tiktok> channel:<#channel> [role:<@role>]` | Pick the announce channel and an optional ping role for one platform. |
| `/status` | Show the current routing + every tracked account. |
| `/youtube add channel:<url \| @handle \| UC…id>` | Track a YouTube channel. The bot auto-resolves the channel ID. |
| `/youtube remove channel_id:<UC…>` | Stop tracking a channel. |
| `/youtube list` | List tracked channels. |
| `/twitch add username:<login>` | Track a Twitch streamer. |
| `/twitch remove username:<login>` | Untrack a streamer. |
| `/twitch list` | List tracked streamers. |
| `/tiktok add username:<handle>` | Track a TikTok account. |
| `/tiktok remove username:<handle>` | Untrack an account. |
| `/tiktok list` | List tracked accounts. |

All commands require the **Manage Server** permission.

---

## Setup

### 1. Create the Discord application

1. Go to <https://discord.com/developers/applications> and create a new application.
2. In **Bot**, create a bot user. Copy the **token** → `DISCORD_TOKEN`.
3. In **OAuth2 → URL Generator**, pick the scopes `bot` and `applications.commands`. For bot permissions tick `Send Messages`, `Embed Links`, `Mention Everyone` (only needed if you want role pings), and `View Channels`. Open the generated URL to invite the bot to your server.
4. Copy the **Application ID** → `DISCORD_CLIENT_ID`.
5. (Optional, dev only) Copy your server ID → `DISCORD_GUILD_ID`. Guild commands sync instantly; global commands take up to an hour.

### 2. Create the Twitch application

1. Go to <https://dev.twitch.tv/console/apps> and register an app (any OAuth redirect URL works; we only use client credentials).
2. Copy the **Client ID** → `TWITCH_CLIENT_ID`.
3. Copy the **Client Secret** → `TWITCH_CLIENT_SECRET`.

If you skip this step, Twitch tracking is automatically disabled — YouTube + TikTok still work.

### 3. Deploy a RSSHub instance (for TikTok)

The free public `rsshub.app` is often rate-limited by TikTok. Deploy your own:

1. On Railway, click **New → Deploy from GitHub repo** and pick `DIYgod/RSSHub`. Or use the Docker image `diygod/rsshub` directly.
2. Set the env var `PORT=1200` and (recommended) `CACHE_TYPE=memory`.
3. After deploy, grab the public URL (e.g. `https://rsshub-production-xxxx.up.railway.app`).
4. Set `RSSHUB_URL=<that URL>` on the notify-me service.

Test it: `https://<your-rsshub>/tiktok/user/@charlidamelio` should return XML.

### 4. Configure env vars

Copy `.env.example` to `.env` and fill it in.

```bash
cp .env.example .env
```

---

## Run locally

```bash
npm install
npm run deploy-commands   # one-off, registers the slash commands with Discord
npm run dev               # starts the bot with hot reload
```

In your Discord server:

```text
/setchannel platform:YouTube channel:#youtube-annonces
/setchannel platform:Twitch  channel:#twitch-annonces
/setchannel platform:TikTok  channel:#tiktok-annonces

/youtube add channel:https://www.youtube.com/@MrBeast
/twitch  add username:zerator
/tiktok  add username:charlidamelio
```

`/status` will confirm the configuration.

---

## Deploy on Railway

1. **Push this repo to GitHub.**
2. On Railway: **New Project → Deploy from GitHub repo**. Select the repo. Railway detects the `Dockerfile` automatically.
3. **Add a Volume** to the service, mount path `/data`. This is where the SQLite file lives — without a volume, your subscriptions are wiped on every redeploy.
4. **Set the environment variables** in the service's Variables tab:
   - `DISCORD_TOKEN`
   - `DISCORD_CLIENT_ID`
   - `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`
   - `RSSHUB_URL` (the URL of the RSSHub service you deployed)
   - `DATABASE_PATH=/data/notify.db`
   - (Optional) `DISCORD_GUILD_ID` if you want commands scoped to one server
5. **Deploy.** Watch the logs for `Logged in as <bot>#0000 — serving N guild(s).`
6. **Register the slash commands** once: open the Railway CLI in the project and run:
   ```bash
   railway run npm run deploy-commands
   ```
   Or run it locally with the same `.env`; either works because it just calls Discord's REST API.

That's it. The bot polls YouTube every 5 min, Twitch every 2 min, TikTok every 10 min (configurable via `YOUTUBE_CRON` / `TWITCH_CRON` / `TIKTOK_CRON`).

---

## How detection works

| Platform | Method | Latency |
|---|---|---|
| YouTube | `youtube.com/feeds/videos.xml?channel_id=UC...` polled every 5 min. Includes regular videos and Shorts. | ≤ 5 min |
| Twitch | Helix `GET /streams?user_login=...` polled every 2 min. State machine ensures one announcement per stream. | ≤ 2 min |
| TikTok | RSSHub `/tiktok/user/@username` polled every 10 min. | ≤ 10 min |

The bot remembers the last seen video / stream ID per subscription, so it never double-announces.

### First-run behavior

When you add a new subscription, the **most recent existing item is silently recorded as the baseline** — you won't get spammed with old uploads. Announcements start from the *next* new item.

---

## Project structure

```
src/
├── index.ts                 # entry point
├── config.ts                # env validation (zod)
├── scheduler.ts             # cron jobs
├── notifier.ts              # send Discord embeds
├── bot/
│   ├── client.ts            # Discord client
│   ├── deploy-commands.ts   # register slash commands
│   └── commands/
│       ├── index.ts         # registry + interaction handler
│       ├── setchannel.ts
│       ├── status.ts
│       ├── youtube.ts
│       ├── twitch.ts
│       └── tiktok.ts
├── db/
│   └── index.ts             # SQLite schema + repos
└── services/
    ├── youtube.ts           # poll YouTube RSS
    ├── youtube-resolve.ts   # URL/@handle → channelId
    ├── twitch.ts            # poll Twitch lives
    ├── twitch-api.ts        # Helix client
    └── tiktok.ts            # poll TikTok via RSSHub
```

---

## Troubleshooting

**Slash commands don't appear.** Did you run `npm run deploy-commands`? Global commands can take up to an hour to propagate; set `DISCORD_GUILD_ID` during dev to get instant updates.

**Twitch tracking is silent.** Check `TWITCH_CLIENT_ID` / `TWITCH_CLIENT_SECRET` are set. Look for `Twitch job disabled (missing credentials)` in the logs.

**TikTok feed returns nothing.** Test your RSSHub URL directly in a browser. Some accounts (private, region-locked) return empty feeds. Try a known active account first.

**Bot is silent after adding a channel.** This is by design — the first poll records the latest existing item as a baseline. Post a new video / go live to trigger the announcement.

**Database resets on redeploy.** On Railway, attach a Volume mounted at `/data` and ensure `DATABASE_PATH=/data/notify.db`.
