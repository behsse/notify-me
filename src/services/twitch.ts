import { hasTwitchCredentials } from "../config.js";
import { twitchRepo } from "../db/index.js";
import { sendAnnouncement } from "../notifier.js";
import { getStreamsByLogins, getUserByLogin } from "./twitch-api.js";

const TWITCH_COLOR = 0x9146ff;

export async function pollTwitch(): Promise<void> {
  if (!hasTwitchCredentials) return;

  const subs = twitchRepo.all();
  if (subs.length === 0) return;

  await backfillMissingUserInfo(subs);

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
      const thumb = live.thumbnail_url
        .replace("{width}", "1280")
        .replace("{height}", "720");

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
        embed: {
          title: live.title || `${sub.displayName} est en live !`,
          color: TWITCH_COLOR,
          authorName: `${sub.displayName} est en live sur Twitch !`,
          authorIconUrl: sub.profileImageUrl ?? undefined,
          imageUrl: `${thumb}?_=${Date.now()}`,
          timestamp: new Date(live.started_at),
          fields: [
            { name: "Game", value: game, inline: true },
            { name: "Viewers", value: live.viewer_count.toString(), inline: true },
          ],
          buttonLabel: "Watch Stream",
        },
      });

      twitchRepo.setLive(sub.guildId, sub.twitchLogin, live.id);
    } else if (sub.isLive === 1) {
      twitchRepo.setOffline(sub.guildId, sub.twitchLogin);
    }
  }
}

async function backfillMissingUserInfo(
  subs: {
    guildId: string;
    twitchLogin: string;
    userId: string | null;
    profileImageUrl: string | null;
  }[],
): Promise<void> {
  const missing = subs.filter((s) => !s.userId || !s.profileImageUrl);
  for (const sub of missing) {
    try {
      const user = await getUserByLogin(sub.twitchLogin);
      if (user) {
        twitchRepo.updateUserInfo(sub.guildId, sub.twitchLogin, user.id, user.profile_image_url);
        sub.userId = user.id;
        sub.profileImageUrl = user.profile_image_url;
      }
    } catch {
      // best-effort; will retry on next poll
    }
  }
}
