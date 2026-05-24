import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { youtubeRepo } from "../../db/index.js";
import { resolveYoutubeChannel } from "../../services/youtube-resolve.js";
import type { SlashCommand } from "./types.js";

export const youtube: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("youtube")
    .setDescription("Manage tracked YouTube channels")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Track a YouTube channel (URL, @handle, or channel ID)")
        .addStringOption((opt) =>
          opt
            .setName("channel")
            .setDescription("Channel URL, @handle or channel ID (UC…)")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Stop tracking a YouTube channel")
        .addStringOption((opt) =>
          opt
            .setName("channel_id")
            .setDescription("Channel ID (UC…). Use /youtube list to find it.")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName("list").setDescription("List tracked YouTube channels"),
    ),

  async execute(interaction) {
    if (!interaction.inGuild() || !interaction.guildId) {
      await interaction.reply({ content: "Use this command inside a server.", ephemeral: true });
      return;
    }
    const guildId = interaction.guildId;
    const sub = interaction.options.getSubcommand(true);

    if (sub === "add") {
      const input = interaction.options.getString("channel", true);
      await interaction.deferReply({ ephemeral: true });
      try {
        const info = await resolveYoutubeChannel(input);
        youtubeRepo.add(guildId, info.channelId, info.channelName);
        await interaction.editReply(
          `Tracking **${info.channelName}** (\`${info.channelId}\`). New uploads will be announced.`,
        );
      } catch (err) {
        await interaction.editReply(
          `Could not add channel: ${(err as Error).message}`,
        );
      }
      return;
    }

    if (sub === "remove") {
      const channelId = interaction.options.getString("channel_id", true).trim();
      const removed = youtubeRepo.remove(guildId, channelId);
      await interaction.reply({
        content: removed
          ? `Removed \`${channelId}\` from tracked channels.`
          : `No tracked channel matches \`${channelId}\`.`,
        ephemeral: true,
      });
      return;
    }

    if (sub === "list") {
      const items = youtubeRepo.list(guildId);
      if (items.length === 0) {
        await interaction.reply({ content: "No YouTube channels tracked yet.", ephemeral: true });
        return;
      }
      const lines = items.map((i) => `• **${i.channelName}** — \`${i.youtubeChannelId}\``);
      await interaction.reply({
        content: `**Tracked YouTube channels (${items.length}):**\n${lines.join("\n")}`,
        ephemeral: true,
      });
    }
  },
};
