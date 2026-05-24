import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  DISCORD_TOKEN: z.string().min(1, "DISCORD_TOKEN is required"),
  DISCORD_CLIENT_ID: z.string().min(1, "DISCORD_CLIENT_ID is required"),
  DISCORD_GUILD_ID: z.string().optional(),

  TWITCH_CLIENT_ID: z.string().optional(),
  TWITCH_CLIENT_SECRET: z.string().optional(),

  RSSHUB_URL: z.string().url().default("https://rsshub.app"),

  DATABASE_PATH: z.string().default("./data/notify.db"),

  YOUTUBE_CRON: z.string().default("*/5 * * * *"),
  TWITCH_CRON: z.string().default("*/2 * * * *"),
  TIKTOK_CRON: z.string().default("*/10 * * * *"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:");
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

export const config = parsed.data;

export const hasTwitchCredentials = Boolean(
  config.TWITCH_CLIENT_ID && config.TWITCH_CLIENT_SECRET,
);
