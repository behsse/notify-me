import { hasTwitchCredentials } from "../config.js";
import { twitchRepo } from "../db/index.js";
import { sendAnnouncement } from "../notifier.js";
import { getStreamsByLogins } from "./twitch-api.js";

export async function pollTwitch(): Promise<void> {
  if (!hasTwitchCredentials) return;

  const subs = twitchRepo.all();
  if (subs.length === 0) return;

  const uniqueLogins = Array.from(new Set(subs.map((s) => s.twitchLogin.toLowerCase())));
  let streams;
  try {
    streams = await getStreamsByLogins(uniqueLogins);
  } catch (err) {
    console.error("[twitch] poll failed:", (err as Error).message);
    return;
  }

  const liveByLogin = new Map(streams.map((s) => [s.user_login.toLowerCase(), s]));

  for (const sub of subs) {
    const live = liveByLogin.get(sub.twitchLogin);

    if (live && live.type === "live") {
      const isNewStream = sub.lastStreamId !== live.id || sub.isLive === 0;
      if (!isNewStream) continue;

      const thumb = live.thumbnail_url
        .replace("{width}", "1280")
        .replace("{height}", "720");

      await sendAnnouncement({
        guildId: sub.guildId,
        platform: "twitch",
        title: live.title || `${sub.displayName} is live!`,
        url: `https://twitch.tv/${sub.twitchLogin}`,
        description:
          `🔴 **${sub.displayName}** is **LIVE** on Twitch` +
          (live.game_name ? ` — playing **${live.game_name}**` : "") +
          `!`,
        authorName: sub.displayName,
        imageUrl: `${thumb}?_=${Date.now()}`,
        timestamp: new Date(live.started_at),
        footer: "Twitch",
      });

      twitchRepo.setLive(sub.guildId, sub.twitchLogin, live.id);
    } else if (sub.isLive === 1) {
      twitchRepo.setOffline(sub.guildId, sub.twitchLogin);
    }
  }
}
