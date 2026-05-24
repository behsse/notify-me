import { EmbedBuilder, type APIEmbed, type TextChannel } from "discord.js";
import { client } from "./bot/client.js";
import { channelRepo, type Platform } from "./db/index.js";

const COLORS: Record<Platform, number> = {
  youtube: 0xff0000,
  twitch: 0x9146ff,
  tiktok: 0xfe2c55,
};

export interface Announcement {
  guildId: string;
  platform: Platform;
  title: string;
  url: string;
  description?: string;
  authorName?: string;
  authorIconUrl?: string;
  thumbnailUrl?: string;
  imageUrl?: string;
  timestamp?: Date;
  footer?: string;
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

  const embed = new EmbedBuilder()
    .setColor(COLORS[a.platform])
    .setTitle(a.title.slice(0, 256))
    .setURL(a.url);

  if (a.description) embed.setDescription(a.description.slice(0, 4096));
  if (a.authorName) {
    embed.setAuthor({ name: a.authorName.slice(0, 256), iconURL: a.authorIconUrl, url: a.url });
  }
  if (a.thumbnailUrl) embed.setThumbnail(a.thumbnailUrl);
  if (a.imageUrl) embed.setImage(a.imageUrl);
  if (a.timestamp) embed.setTimestamp(a.timestamp);
  if (a.footer) embed.setFooter({ text: a.footer.slice(0, 2048) });

  const content = conf.rolePing ? `<@&${conf.rolePing}>` : undefined;
  const allowedMentions = conf.rolePing ? { roles: [conf.rolePing] } : { parse: [] as never[] };

  try {
    await (channel as TextChannel).send({
      content,
      embeds: [embed.toJSON() as APIEmbed],
      allowedMentions,
    });
    return true;
  } catch (err) {
    console.error(`[notifier] Failed to send to ${conf.channelId}:`, err);
    return false;
  }
}
