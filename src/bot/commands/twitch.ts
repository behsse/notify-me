import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { hasTwitchCredentials } from "../../config.js";
import { twitchRepo } from "../../db/index.js";
import { getUserByLogin } from "../../services/twitch-api.js";
import type { SlashCommand } from "./types.js";

export const twitch: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("twitch")
    .setDescription("Manage tracked Twitch streamers")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Track a Twitch streamer")
        .addStringOption((opt) =>
          opt
            .setName("username")
            .setDescription("Twitch username (login)")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Stop tracking a Twitch streamer")
        .addStringOption((opt) =>
          opt.setName("username").setDescription("Twitch username").setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName("list").setDescription("List tracked Twitch streamers"),
    ),

  async execute(interaction) {
    if (!interaction.inGuild() || !interaction.guildId) {
      await interaction.reply({ content: "Use this command inside a server.", ephemeral: true });
      return;
    }
    const guildId = interaction.guildId;
    const sub = interaction.options.getSubcommand(true);

    if (sub === "add") {
      if (!hasTwitchCredentials) {
        await interaction.reply({
          content:
            "Twitch credentials are not configured on the bot. Ask the admin to set `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET`.",
          ephemeral: true,
        });
        return;
      }
      const username = interaction.options.getString("username", true).trim().replace(/^@/, "");
      await interaction.deferReply({ ephemeral: true });
      try {
        const user = await getUserByLogin(username);
        if (!user) {
          await interaction.editReply(`No Twitch user named \`${username}\`.`);
          return;
        }
        twitchRepo.add(guildId, user.login, user.display_name, user.id, user.profile_image_url);
        await interaction.editReply(
          `Tracking **${user.display_name}** (\`${user.login}\`). Live announcements will fire when they go online.`,
        );
      } catch (err) {
        await interaction.editReply(`Could not add streamer: ${(err as Error).message}`);
      }
      return;
    }

    if (sub === "remove") {
      const username = interaction.options.getString("username", true).trim().replace(/^@/, "");
      const removed = twitchRepo.remove(guildId, username);
      await interaction.reply({
        content: removed
          ? `Removed \`${username}\` from tracked streamers.`
          : `No tracked streamer matches \`${username}\`.`,
        ephemeral: true,
      });
      return;
    }

    if (sub === "list") {
      const items = twitchRepo.list(guildId);
      if (items.length === 0) {
        await interaction.reply({ content: "No Twitch streamers tracked yet.", ephemeral: true });
        return;
      }
      const lines = items.map(
        (i) => `• **${i.displayName}** (\`${i.twitchLogin}\`)${i.isLive ? " — 🔴 live" : ""}`,
      );
      await interaction.reply({
        content: `**Tracked Twitch streamers (${items.length}):**\n${lines.join("\n")}`,
        ephemeral: true,
      });
    }
  },
};
