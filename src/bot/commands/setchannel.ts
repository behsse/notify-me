import {
  ChannelType,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { channelRepo, type Platform } from "../../db/index.js";
import type { SlashCommand } from "./types.js";

const PLATFORMS: Platform[] = ["youtube", "twitch", "tiktok"];

export const setchannel: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("setchannel")
    .setDescription("Define which channel receives announcements for a platform")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addStringOption((opt) =>
      opt
        .setName("platform")
        .setDescription("Platform to configure")
        .setRequired(true)
        .addChoices(
          { name: "YouTube", value: "youtube" },
          { name: "Twitch", value: "twitch" },
          { name: "TikTok", value: "tiktok" },
        ),
    )
    .addChannelOption((opt) =>
      opt
        .setName("channel")
        .setDescription("Discord channel where announcements will be posted")
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(true),
    )
    .addRoleOption((opt) =>
      opt
        .setName("role")
        .setDescription("Optional role to ping on each announcement")
        .setRequired(false),
    ),

  async execute(interaction) {
    if (!interaction.inGuild() || !interaction.guildId) {
      await interaction.reply({ content: "Use this command inside a server.", ephemeral: true });
      return;
    }

    const platform = interaction.options.getString("platform", true) as Platform;
    if (!PLATFORMS.includes(platform)) {
      await interaction.reply({ content: "Unknown platform.", ephemeral: true });
      return;
    }

    const channel = interaction.options.getChannel("channel", true);
    const role = interaction.options.getRole("role", false);

    channelRepo.set(interaction.guildId, platform, channel.id, role?.id ?? null);

    const roleNote = role
      ? role.id === interaction.guildId
        ? " (pings @everyone)"
        : ` (pings <@&${role.id}>)`
      : "";
    await interaction.reply({
      content: `${platformLabel(platform)} announcements will be posted in <#${channel.id}>${roleNote}.`,
      ephemeral: true,
    });
  },
};

function platformLabel(p: Platform) {
  return p === "youtube" ? "YouTube" : p === "twitch" ? "Twitch" : "TikTok";
}
