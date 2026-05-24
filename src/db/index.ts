import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { config } from "../config.js";

const dir = dirname(config.DATABASE_PATH);
if (dir && dir !== "." && !existsSync(dir)) {
  mkdirSync(dir, { recursive: true });
}

export const db = new Database(config.DATABASE_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

function ensureColumn(table: string, column: string, definition: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

db.exec(`
  CREATE TABLE IF NOT EXISTS guild_channels (
    guild_id   TEXT NOT NULL,
    platform   TEXT NOT NULL CHECK (platform IN ('youtube', 'twitch', 'tiktok')),
    channel_id TEXT NOT NULL,
    role_ping  TEXT,
    PRIMARY KEY (guild_id, platform)
  );

  CREATE TABLE IF NOT EXISTS youtube_subs (
    guild_id          TEXT NOT NULL,
    youtube_channel_id TEXT NOT NULL,
    channel_name      TEXT NOT NULL,
    last_video_id     TEXT,
    PRIMARY KEY (guild_id, youtube_channel_id)
  );

  CREATE TABLE IF NOT EXISTS twitch_subs (
    guild_id     TEXT NOT NULL,
    twitch_login TEXT NOT NULL,
    display_name TEXT NOT NULL,
    last_stream_id TEXT,
    is_live      INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (guild_id, twitch_login)
  );

  CREATE TABLE IF NOT EXISTS tiktok_subs (
    guild_id      TEXT NOT NULL,
    tiktok_user   TEXT NOT NULL,
    last_video_id TEXT,
    PRIMARY KEY (guild_id, tiktok_user)
  );

  CREATE TABLE IF NOT EXISTS customizations (
    guild_id TEXT NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('youtube', 'twitch', 'tiktok')),
    template TEXT,
    color    INTEGER,
    PRIMARY KEY (guild_id, platform)
  );
`);

ensureColumn("twitch_subs", "user_id", "TEXT");
ensureColumn("twitch_subs", "profile_image_url", "TEXT");

export type Platform = "youtube" | "twitch" | "tiktok";

export const channelRepo = {
  set(guildId: string, platform: Platform, channelId: string, rolePing: string | null = null) {
    db.prepare(
      `INSERT INTO guild_channels (guild_id, platform, channel_id, role_ping)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(guild_id, platform) DO UPDATE SET
         channel_id = excluded.channel_id,
         role_ping  = excluded.role_ping`,
    ).run(guildId, platform, channelId, rolePing);
  },

  get(guildId: string, platform: Platform) {
    return db
      .prepare(
        `SELECT channel_id as channelId, role_ping as rolePing
         FROM guild_channels WHERE guild_id = ? AND platform = ?`,
      )
      .get(guildId, platform) as { channelId: string; rolePing: string | null } | undefined;
  },

  listForGuild(guildId: string) {
    return db
      .prepare(
        `SELECT platform, channel_id as channelId, role_ping as rolePing
         FROM guild_channels WHERE guild_id = ?`,
      )
      .all(guildId) as { platform: Platform; channelId: string; rolePing: string | null }[];
  },
};

export const youtubeRepo = {
  add(guildId: string, youtubeChannelId: string, channelName: string) {
    db.prepare(
      `INSERT OR IGNORE INTO youtube_subs (guild_id, youtube_channel_id, channel_name)
       VALUES (?, ?, ?)`,
    ).run(guildId, youtubeChannelId, channelName);
  },

  remove(guildId: string, youtubeChannelId: string) {
    return db
      .prepare(`DELETE FROM youtube_subs WHERE guild_id = ? AND youtube_channel_id = ?`)
      .run(guildId, youtubeChannelId).changes;
  },

  list(guildId: string) {
    return db
      .prepare(
        `SELECT youtube_channel_id as youtubeChannelId, channel_name as channelName
         FROM youtube_subs WHERE guild_id = ?`,
      )
      .all(guildId) as { youtubeChannelId: string; channelName: string }[];
  },

  all() {
    return db
      .prepare(
        `SELECT guild_id as guildId,
                youtube_channel_id as youtubeChannelId,
                channel_name as channelName,
                last_video_id as lastVideoId
         FROM youtube_subs`,
      )
      .all() as {
      guildId: string;
      youtubeChannelId: string;
      channelName: string;
      lastVideoId: string | null;
    }[];
  },

  setLastVideo(guildId: string, youtubeChannelId: string, videoId: string) {
    db.prepare(
      `UPDATE youtube_subs SET last_video_id = ?
       WHERE guild_id = ? AND youtube_channel_id = ?`,
    ).run(videoId, guildId, youtubeChannelId);
  },
};

export const twitchRepo = {
  add(
    guildId: string,
    twitchLogin: string,
    displayName: string,
    userId: string | null = null,
    profileImageUrl: string | null = null,
  ) {
    db.prepare(
      `INSERT INTO twitch_subs (guild_id, twitch_login, display_name, user_id, profile_image_url)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(guild_id, twitch_login) DO UPDATE SET
         display_name = excluded.display_name,
         user_id = COALESCE(excluded.user_id, twitch_subs.user_id),
         profile_image_url = COALESCE(excluded.profile_image_url, twitch_subs.profile_image_url)`,
    ).run(guildId, twitchLogin.toLowerCase(), displayName, userId, profileImageUrl);
  },

  updateUserInfo(guildId: string, twitchLogin: string, userId: string, profileImageUrl: string) {
    db.prepare(
      `UPDATE twitch_subs SET user_id = ?, profile_image_url = ?
       WHERE guild_id = ? AND twitch_login = ?`,
    ).run(userId, profileImageUrl, guildId, twitchLogin.toLowerCase());
  },

  remove(guildId: string, twitchLogin: string) {
    return db
      .prepare(`DELETE FROM twitch_subs WHERE guild_id = ? AND twitch_login = ?`)
      .run(guildId, twitchLogin.toLowerCase()).changes;
  },

  list(guildId: string) {
    return db
      .prepare(
        `SELECT twitch_login as twitchLogin, display_name as displayName, is_live as isLive
         FROM twitch_subs WHERE guild_id = ?`,
      )
      .all(guildId) as { twitchLogin: string; displayName: string; isLive: number }[];
  },

  all() {
    return db
      .prepare(
        `SELECT guild_id as guildId,
                twitch_login as twitchLogin,
                display_name as displayName,
                last_stream_id as lastStreamId,
                is_live as isLive,
                user_id as userId,
                profile_image_url as profileImageUrl
         FROM twitch_subs`,
      )
      .all() as {
      guildId: string;
      twitchLogin: string;
      displayName: string;
      lastStreamId: string | null;
      isLive: number;
      userId: string | null;
      profileImageUrl: string | null;
    }[];
  },

  setLive(guildId: string, twitchLogin: string, streamId: string) {
    db.prepare(
      `UPDATE twitch_subs SET is_live = 1, last_stream_id = ?
       WHERE guild_id = ? AND twitch_login = ?`,
    ).run(streamId, guildId, twitchLogin.toLowerCase());
  },

  setOffline(guildId: string, twitchLogin: string) {
    db.prepare(
      `UPDATE twitch_subs SET is_live = 0
       WHERE guild_id = ? AND twitch_login = ?`,
    ).run(guildId, twitchLogin.toLowerCase());
  },
};

export const tiktokRepo = {
  add(guildId: string, tiktokUser: string) {
    db.prepare(
      `INSERT OR IGNORE INTO tiktok_subs (guild_id, tiktok_user) VALUES (?, ?)`,
    ).run(guildId, tiktokUser.toLowerCase());
  },

  remove(guildId: string, tiktokUser: string) {
    return db
      .prepare(`DELETE FROM tiktok_subs WHERE guild_id = ? AND tiktok_user = ?`)
      .run(guildId, tiktokUser.toLowerCase()).changes;
  },

  list(guildId: string) {
    return db
      .prepare(`SELECT tiktok_user as tiktokUser FROM tiktok_subs WHERE guild_id = ?`)
      .all(guildId) as { tiktokUser: string }[];
  },

  all() {
    return db
      .prepare(
        `SELECT guild_id as guildId,
                tiktok_user as tiktokUser,
                last_video_id as lastVideoId
         FROM tiktok_subs`,
      )
      .all() as { guildId: string; tiktokUser: string; lastVideoId: string | null }[];
  },

  setLastVideo(guildId: string, tiktokUser: string, videoId: string) {
    db.prepare(
      `UPDATE tiktok_subs SET last_video_id = ?
       WHERE guild_id = ? AND tiktok_user = ?`,
    ).run(videoId, guildId, tiktokUser.toLowerCase());
  },
};

export const customizationRepo = {
  get(guildId: string, platform: Platform) {
    return db
      .prepare(
        `SELECT template FROM customizations WHERE guild_id = ? AND platform = ?`,
      )
      .get(guildId, platform) as { template: string | null } | undefined;
  },

  setTemplate(guildId: string, platform: Platform, template: string) {
    db.prepare(
      `INSERT INTO customizations (guild_id, platform, template)
       VALUES (?, ?, ?)
       ON CONFLICT(guild_id, platform) DO UPDATE SET template = excluded.template`,
    ).run(guildId, platform, template);
  },

  resetTemplate(guildId: string, platform: Platform) {
    db.prepare(
      `UPDATE customizations SET template = NULL WHERE guild_id = ? AND platform = ?`,
    ).run(guildId, platform);
  },
};
