import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type APIEmbed,
  type TextChannel,
} from "discord.js";
import { client } from "./bot/client.js";
import { channelRepo, customizationRepo, type Platform } from "./db/index.js";
import { DEFAULT_COLORS, DEFAULT_TEMPLATES, renderTemplate } from "./services/template.js";

export interface AnnouncementField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface Announcement {
  guildId: string;
  platform: Platform;
  title: string;
  url: string;
  vars: Record<string, string>;
  authorName?: string;
  authorIconUrl?: string;
  thumbnailUrl?: string;
  imageUrl?: string;
  timestamp?: Date;
  footer?: string;
  fields?: AnnouncementField[];
  buttonLabel?: string;
  /** If true, put the rendered template in the message content (above the embed) instead of the embed description. */
  textAsContent?: boolean;
  /** If true, send only plain content with the URL — no bot embed. Discord will auto-embed the URL natively. */
  plainMode?: boolean;
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
  const color = custom?.color ?? DEFAULT_COLORS[a.platform];
  const description = renderTemplate(template, a.vars);
  const allowedMentions = conf.rolePing ? { roles: [conf.rolePing] } : { parse: [] as never[] };
  const pingPrefix = conf.rolePing ? `<@&${conf.rolePing}>` : "";

  if (a.plainMode) {
    const lines = [pingPrefix, description].filter(Boolean);
    const text = lines.join(" ").trim();
    const hasUrl = text.includes(a.url);
    const content = hasUrl ? text : `${text}\n${a.url}`.trim();
    try {
      await (channel as TextChannel).send({ content, allowedMentions });
      return true;
    } catch (err) {
      console.error(`[notifier] Failed to send plain to ${conf.channelId}:`, err);
      return false;
    }
  }

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(a.title.slice(0, 256))
    .setURL(a.url);

  if (a.authorName) {
    embed.setAuthor({ name: a.authorName.slice(0, 256), iconURL: a.authorIconUrl, url: a.url });
  }
  if (a.thumbnailUrl) embed.setThumbnail(a.thumbnailUrl);
  if (a.imageUrl) embed.setImage(a.imageUrl);
  if (a.timestamp) embed.setTimestamp(a.timestamp);
  if (a.footer) embed.setFooter({ text: a.footer.slice(0, 2048) });
  if (a.fields && a.fields.length > 0) {
    embed.addFields(a.fields.map((f) => ({ name: f.name, value: f.value, inline: f.inline ?? false })));
  }

  if (!a.textAsContent && description) {
    embed.setDescription(description.slice(0, 4096));
  }

  const content =
    a.textAsContent && description
      ? [pingPrefix, description].filter(Boolean).join(" ").trim()
      : pingPrefix || undefined;

  const components: ActionRowBuilder<ButtonBuilder>[] = [];
  if (a.buttonLabel) {
    components.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setLabel(a.buttonLabel.slice(0, 80))
          .setStyle(ButtonStyle.Link)
          .setURL(a.url),
      ),
    );
  }

  try {
    await (channel as TextChannel).send({
      content,
      embeds: [embed.toJSON() as APIEmbed],
      allowedMentions,
      components: components.length > 0 ? components : undefined,
    });
    return true;
  } catch (err) {
    console.error(`[notifier] Failed to send to ${conf.channelId}:`, err);
    return false;
  }
}
