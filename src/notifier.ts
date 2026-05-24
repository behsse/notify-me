import type { MessageMentionTypes, TextChannel } from "discord.js";
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

  const isEveryone = conf.rolePing === a.guildId;
  const ping = conf.rolePing
    ? isEveryone
      ? "@everyone"
      : `<@&${conf.rolePing}>`
    : "";

  const parts: string[] = [];
  if (ping) parts.push(ping);
  if (rendered) parts.push(rendered);
  if (!rendered.includes(a.url)) parts.push(a.url);
  const content = parts.join("\n");

  const allowedMentions: { parse?: MessageMentionTypes[]; roles?: string[] } = !conf.rolePing
    ? { parse: [] }
    : isEveryone
      ? { parse: ["everyone"] }
      : { roles: [conf.rolePing] };

  try {
    await (channel as TextChannel).send({ content, allowedMentions });
    return true;
  } catch (err) {
    console.error(`[notifier] Failed to send to ${conf.channelId}:`, err);
    return false;
  }
}
