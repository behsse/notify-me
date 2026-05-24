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

      const streamUrl = `https://twitch.tv/${sub.twitchLogin}`;
      const game = live.game_name || "Just Chatting";

      await sendAnnouncement({
        guildId: sub.guildId,
        platform: "twitch",
        url: streamUrl,
        vars: {
          author: sub.displayName,
          title: live.title || "",
          url: streamUrl,
          game,
        },
      });

      twitchRepo.setLive(sub.guildId, sub.twitchLogin, live.id);
    } else if (sub.isLive === 1) {
      twitchRepo.setOffline(sub.guildId, sub.twitchLogin);
    }
  }
}
