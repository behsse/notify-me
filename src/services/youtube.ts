import Parser from "rss-parser";
import { youtubeRepo } from "../db/index.js";
import { sendAnnouncement } from "../notifier.js";

interface YoutubeFeedItem {
  id?: string;
  link?: string;
  title?: string;
  pubDate?: string;
  isoDate?: string;
  author?: string;
}

const parser = new Parser<{}, YoutubeFeedItem>({
  customFields: {
    item: [["yt:videoId", "videoId"]],
  },
  timeout: 15_000,
});

const FEED_URL = (channelId: string) =>
  `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;

export async function pollYoutube(): Promise<void> {
  const subs = youtubeRepo.all();
  if (subs.length === 0) return;

  for (const sub of subs) {
    try {
      const feed = await parser.parseURL(FEED_URL(sub.youtubeChannelId));
      const items = (feed.items as (YoutubeFeedItem & { videoId?: string })[]) ?? [];
      if (items.length === 0) continue;

      const latest = items[0];
      const videoId = latest.videoId ?? extractVideoIdFromLink(latest.link);
      if (!videoId) continue;

      if (sub.lastVideoId === null) {
        youtubeRepo.setLastVideo(sub.guildId, sub.youtubeChannelId, videoId);
        continue;
      }

      if (videoId === sub.lastVideoId) continue;

      const pubDate = latest.isoDate ? new Date(latest.isoDate) : undefined;
      if (pubDate && Date.now() - pubDate.getTime() > 7 * 24 * 60 * 60 * 1000) {
        youtubeRepo.setLastVideo(sub.guildId, sub.youtubeChannelId, videoId);
        continue;
      }

      const url = latest.link ?? `https://www.youtube.com/watch?v=${videoId}`;
      const isShort = /\/shorts\//i.test(url);

      await sendAnnouncement({
        guildId: sub.guildId,
        platform: "youtube",
        url,
        vars: {
          author: sub.channelName,
          title: latest.title ?? "",
          url,
          type: isShort ? "short" : "vidéo",
        },
      });

      youtubeRepo.setLastVideo(sub.guildId, sub.youtubeChannelId, videoId);
    } catch (err) {
      console.error(`[youtube] poll failed for ${sub.youtubeChannelId}:`, (err as Error).message);
    }
  }
}

function extractVideoIdFromLink(link: string | undefined): string | null {
  if (!link) return null;
  const m = link.match(/[?&]v=([A-Za-z0-9_-]{11})/);
  if (m) return m[1];
  const s = link.match(/\/shorts\/([A-Za-z0-9_-]{11})/);
  return s?.[1] ?? null;
}
