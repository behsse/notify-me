import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type APIEmbed,
  type MessageMentionTypes,
  type TextChannel,
} from "discord.js";
import { client } from "./bot/client.js";
import { channelRepo, customizationRepo, type Platform } from "./db/index.js";
import { DEFAULT_TEMPLATES, renderTemplate } from "./services/template.js";

export interface AnnouncementField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface AnnouncementEmbed {
  title: string;
  color?: number;
  authorName?: string;
  authorIconUrl?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  timestamp?: Date;
  fields?: AnnouncementField[];
  buttonLabel?: string;
  footer?: string;
}

export interface Announcement {
  guildId: string;
  platform: Platform;
  url: string;
  vars: Record<string, string>;
  /** If provided, render a rich bot-built embed. Otherwise plain content (Discord auto-embeds the URL). */
  embed?: AnnouncementEmbed;
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

  const allowedMentions: { parse?: MessageMentionTypes[]; roles?: string[] } = !conf.rolePing
    ? { parse: [] }
    : isEveryone
      ? { parse: ["everyone"] }
      : { roles: [conf.rolePing] };

  if (a.embed) {
    return sendEmbedMessage(channel as TextChannel, conf.channelId, {
      ping,
      rendered,
      embed: a.embed,
      url: a.url,
      allowedMentions,
    });
  }

  const parts: string[] = [];
  if (ping) parts.push(ping);
  if (rendered) parts.push(rendered);
  if (!rendered.includes(a.url)) parts.push(a.url);
  const content = parts.join("\n");

  try {
    await (channel as TextChannel).send({ content, allowedMentions });
    return true;
  } catch (err) {
    console.error(`[notifier] Failed to send to ${conf.channelId}:`, err);
    return false;
  }
}

async function sendEmbedMessage(
  channel: TextChannel,
  channelId: string,
  args: {
    ping: string;
    rendered: string;
    embed: AnnouncementEmbed;
    url: string;
    allowedMentions: { parse?: MessageMentionTypes[]; roles?: string[] };
  },
): Promise<boolean> {
  const { ping, rendered, embed: e, url, allowedMentions } = args;

  const embed = new EmbedBuilder().setTitle(e.title.slice(0, 256)).setURL(url);
  if (e.color !== undefined) embed.setColor(e.color);
  if (e.authorName) {
    embed.setAuthor({ name: e.authorName.slice(0, 256), iconURL: e.authorIconUrl, url });
  }
  if (e.thumbnailUrl) embed.setThumbnail(e.thumbnailUrl);
  if (e.imageUrl) embed.setImage(e.imageUrl);
  if (e.timestamp) embed.setTimestamp(e.timestamp);
  if (e.footer) embed.setFooter({ text: e.footer.slice(0, 2048) });
  if (e.fields && e.fields.length > 0) {
    embed.addFields(
      e.fields.map((f) => ({ name: f.name, value: f.value, inline: f.inline ?? false })),
    );
  }

  const contentParts = [ping, rendered].filter(Boolean);
  const content = contentParts.length > 0 ? contentParts.join("\n") : undefined;

  const components: ActionRowBuilder<ButtonBuilder>[] = [];
  if (e.buttonLabel) {
    components.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setLabel(e.buttonLabel.slice(0, 80))
          .setStyle(ButtonStyle.Link)
          .setURL(url),
      ),
    );
  }

  try {
    await channel.send({
      content,
      embeds: [embed.toJSON() as APIEmbed],
      allowedMentions,
      components: components.length > 0 ? components : undefined,
    });
    return true;
  } catch (err) {
    console.error(`[notifier] Failed to send embed to ${channelId}:`, err);
    return false;
  }
}
