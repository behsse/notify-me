import Parser from "rss-parser";
import { config } from "../config.js";
import { tiktokRepo } from "../db/index.js";
import { sendAnnouncement } from "../notifier.js";

const parser = new Parser({ timeout: 20_000 });

const FEED_URL = (user: string) =>
  `${config.RSSHUB_URL.replace(/\/$/, "")}/tiktok/user/@${user}`;

export async function pollTikTok(): Promise<void> {
  const subs = tiktokRepo.all();
  if (subs.length === 0) return;

  for (const sub of subs) {
    try {
      const feed = await parser.parseURL(FEED_URL(sub.tiktokUser));
      const items = feed.items ?? [];
      if (items.length === 0) continue;

      const latest = items[0];
      const link = latest.link ?? latest.guid;
      if (!link) continue;

      const videoId = extractTiktokVideoId(link) ?? link;

      if (sub.lastVideoId === null) {
        tiktokRepo.setLastVideo(sub.guildId, sub.tiktokUser, videoId);
        continue;
      }

      if (videoId === sub.lastVideoId) continue;

      const pubDate = latest.isoDate ? new Date(latest.isoDate) : undefined;
      if (pubDate && Date.now() - pubDate.getTime() > 14 * 24 * 60 * 60 * 1000) {
        tiktokRepo.setLastVideo(sub.guildId, sub.tiktokUser, videoId);
        continue;
      }

      const cover = extractCoverImage(latest.content ?? "");
      const titleText = latest.title?.toString() ?? "";

      await sendAnnouncement({
        guildId: sub.guildId,
        platform: "tiktok",
        title: titleText.slice(0, 256) || `New TikTok from @${sub.tiktokUser}`,
        url: link,
        vars: {
          author: sub.tiktokUser,
          title: titleText,
          url: link,
        },
        authorName: `@${sub.tiktokUser}`,
        imageUrl: cover ?? undefined,
        timestamp: pubDate,
        footer: "TikTok",
      });

      tiktokRepo.setLastVideo(sub.guildId, sub.tiktokUser, videoId);
    } catch (err) {
      console.error(`[tiktok] poll failed for @${sub.tiktokUser}:`, (err as Error).message);
    }
  }
}

function extractTiktokVideoId(url: string): string | null {
  const m = url.match(/\/video\/(\d+)/);
  return m?.[1] ?? null;
}

function extractCoverImage(html: string): string | null {
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m?.[1] ?? null;
}

