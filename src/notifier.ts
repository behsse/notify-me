import type { TextChannel } from "discord.js";
import { client } from "./bot/client.js";
import { channelRepo, customizationRepo, type Platform } from "./db/index.js";
import { DEFAULT_TEMPLATES, renderTemplate } from "./services/template.js";

export interface Announcement {
  guildId: string;
  platform: Platform;
  url: string;
  vars: Record<string, string>;
}

export async function sendAnnouncement(a: Announcement): Promise<boolean> {
  const conf = channelRepo.get(a.guildId, a.platform);
  if (!conf) {
    console.warn(`[notifier] No channel configured for ${a.platform} in guild ${a.guildId}`);
    return false;
  }

  const channel = await client.channels.fetch(conf.channelId).catch(() => null);
  if (!channel || !channel.isTextBased() || !("send" in channel)) {
    console.warn(`[notifier] Channel ${conf.channelId} is not a sendable text channel`);
    return false;
  }

  const custom = customizationRepo.get(a.guildId, a.platform);
  const template = custom?.template ?? DEFAULT_TEMPLATES[a.platform];
  const rendered = renderTemplate(template, a.vars);
  const ping = conf.rolePing ? `<@&${conf.rolePing}>` : "";

  const text = [ping, rendered].filter(Boolean).join(" ").trim();
  const content = text.includes(a.url) ? text : `${text}\n${a.url}`.trim();

  const allowedMentions = conf.rolePing ? { roles: [conf.rolePing] } : { parse: [] as never[] };

  try {
    await (channel as TextChannel).send({ content, allowedMentions });
    return true;
  } catch (err) {
    console.error(`[notifier] Failed to send to ${conf.channelId}:`, err);
    return false;
  }
}
