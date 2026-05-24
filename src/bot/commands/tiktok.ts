import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { tiktokRepo } from "../../db/index.js";
import type { SlashCommand } from "./types.js";

const USERNAME_RE = /^[A-Za-z0-9_.]{2,24}$/;

function normalize(input: string): string {
  return input.trim().replace(/^@/, "").toLowerCase();
}

export const tiktok: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("tiktok")
    .setDescription("Manage tracked TikTok accounts")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Track a TikTok account")
        .addStringOption((opt) =>
          opt
            .setName("username")
            .setDescription("TikTok username (without the @)")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Stop tracking a TikTok account")
        .addStringOption((opt) =>
          opt.setName("username").setDescription("TikTok username").setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName("list").setDescription("List tracked TikTok accounts"),
    ),

  async execute(interaction) {
    if (!interaction.inGuild() || !interaction.guildId) {
      await interaction.reply({ content: "Use this command inside a server.", ephemeral: true });
      return;
    }
    const guildId = interaction.guildId;
    const sub = interaction.options.getSubcommand(true);

    if (sub === "add") {
      const username = normalize(interaction.options.getString("username", true));
      if (!USERNAME_RE.test(username)) {
        await interaction.reply({
          content:
            "Invalid TikTok username. Use 2–24 chars (letters, digits, `.`, `_`).",
          ephemeral: true,
        });
        return;
      }
      tiktokRepo.add(guildId, username);
      await interaction.reply({
        content: `Tracking **@${username}**. New TikToks will be announced.`,
        ephemeral: true,
      });
      return;
    }

    if (sub === "remove") {
      const username = normalize(interaction.options.getString("username", true));
      const removed = tiktokRepo.remove(guildId, username);
      await interaction.reply({
        content: removed
          ? `Removed \`@${username}\` from tracked accounts.`
          : `No tracked account matches \`@${username}\`.`,
        ephemeral: true,
      });
      return;
    }

    if (sub === "list") {
      const items = tiktokRepo.list(guildId);
      if (items.length === 0) {
        await interaction.reply({ content: "No TikTok accounts tracked yet.", ephemeral: true });
        return;
      }
      const lines = items.map((i) => `• \`@${i.tiktokUser}\``);
      await interaction.reply({
        content: `**Tracked TikTok accounts (${items.length}):**\n${lines.join("\n")}`,
        ephemeral: true,
      });
    }
  },
};
