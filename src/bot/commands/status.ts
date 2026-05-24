import { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { channelRepo, tiktokRepo, twitchRepo, youtubeRepo } from "../../db/index.js";
import type { SlashCommand } from "./types.js";

export const status: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("status")
    .setDescription("Show current bot configuration for this server")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),

  async execute(interaction) {
    if (!interaction.inGuild() || !interaction.guildId) {
      await interaction.reply({ content: "Use this command inside a server.", ephemeral: true });
      return;
    }

    const guildId = interaction.guildId;
    const channels = channelRepo.listForGuild(guildId);
    const youtube = youtubeRepo.list(guildId);
    const twitch = twitchRepo.list(guildId);
    const tiktok = tiktokRepo.list(guildId);

    const channelLine = (platform: "youtube" | "twitch" | "tiktok") => {
      const conf = channels.find((c) => c.platform === platform);
      if (!conf) return "_not configured_";
      const ping = conf.rolePing ? ` · pings <@&${conf.rolePing}>` : "";
      return `<#${conf.channelId}>${ping}`;
    };

    const embed = new EmbedBuilder()
      .setTitle("Notify-Me — Configuration")
      .setColor(0x5865f2)
      .addFields(
        {
          name: "YouTube",
          value:
            `**Channel:** ${channelLine("youtube")}\n` +
            `**Subscriptions (${youtube.length}):** ` +
            (youtube.length
              ? youtube.map((y) => `\`${y.channelName}\``).join(", ")
              : "_none_"),
        },
        {
          name: "Twitch",
          value:
            `**Channel:** ${channelLine("twitch")}\n` +
            `**Streamers (${twitch.length}):** ` +
            (twitch.length
              ? twitch
                  .map((t) => `\`${t.displayName}\`${t.isLive ? " 🔴" : ""}`)
                  .join(", ")
              : "_none_"),
        },
        {
          name: "TikTok",
          value:
            `**Channel:** ${channelLine("tiktok")}\n` +
            `**Accounts (${tiktok.length}):** ` +
            (tiktok.length
              ? tiktok.map((t) => `\`@${t.tiktokUser}\``).join(", ")
              : "_none_"),
        },
      );

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
