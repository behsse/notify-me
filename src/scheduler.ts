import cron from "node-cron";
import { config, hasTwitchCredentials } from "./config.js";
import { pollTikTok } from "./services/tiktok.js";
import { pollTwitch } from "./services/twitch.js";
import { pollYoutube } from "./services/youtube.js";

type Job = { name: string; cron: string; run: () => Promise<void> };

const jobs: Job[] = [
  { name: "youtube", cron: config.YOUTUBE_CRON, run: pollYoutube },
  { name: "twitch", cron: config.TWITCH_CRON, run: pollTwitch },
  { name: "tiktok", cron: config.TIKTOK_CRON, run: pollTikTok },
];

const running = new Set<string>();

async function runOnce(job: Job) {
  if (running.has(job.name)) {
    console.log(`[scheduler] ${job.name} still running, skipping tick`);
    return;
  }
  running.add(job.name);
  const start = Date.now();
  try {
    await job.run();
    console.log(`[scheduler] ${job.name} ok in ${Date.now() - start}ms`);
  } catch (err) {
    console.error(`[scheduler] ${job.name} crashed:`, err);
  } finally {
    running.delete(job.name);
  }
}

export function startScheduler() {
  for (const job of jobs) {
    if (job.name === "twitch" && !hasTwitchCredentials) {
      console.warn(`[scheduler] Twitch job disabled (missing credentials)`);
      continue;
    }
    if (!cron.validate(job.cron)) {
      console.error(`[scheduler] Invalid cron expression for ${job.name}: ${job.cron}`);
      continue;
    }
    cron.schedule(job.cron, () => void runOnce(job));
    console.log(`[scheduler] ${job.name} scheduled (${job.cron})`);
  }

  setTimeout(() => {
    for (const job of jobs) {
      if (job.name === "twitch" && !hasTwitchCredentials) continue;
      void runOnce(job);
    }
  }, 5_000);
}
