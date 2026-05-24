import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { customizationRepo, type Platform } from "../../db/index.js";
import {
  AVAILABLE_PLACEHOLDERS,
  DEFAULT_TEMPLATES,
} from "../../services/template.js";
import type { SlashCommand } from "./types.js";

const PLATFORM_CHOICES = [
  { name: "YouTube", value: "youtube" },
  { name: "Twitch", value: "twitch" },
  { name: "TikTok", value: "tiktok" },
] as const;

export const message: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("message")
    .setDescription("Personnaliser le message d'annonce par plateforme")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName("set")
        .setDescription("Définir un message personnalisé")
        .addStringOption((o) =>
          o
            .setName("platform")
            .setDescription("Plateforme")
            .setRequired(true)
            .addChoices(...PLATFORM_CHOICES),
        )
        .addStringOption((o) =>
          o
            .setName("template")
            .setDescription("Texte avec des {placeholders} — ex: 🔴 {author} est en live !")
            .setRequired(true)
            .setMaxLength(1000),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("reset")
        .setDescription("Revenir au message par défaut")
        .addStringOption((o) =>
          o
            .setName("platform")
            .setDescription("Plateforme")
            .setRequired(true)
            .addChoices(...PLATFORM_CHOICES),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("show")
        .setDescription("Voir le message actuel et les placeholders disponibles")
        .addStringOption((o) =>
          o
            .setName("platform")
            .setDescription("Plateforme")
            .setRequired(true)
            .addChoices(...PLATFORM_CHOICES),
        ),
    ),

  async execute(interaction) {
    if (!interaction.inGuild() || !interaction.guildId) {
      await interaction.reply({ content: "Use this command inside a server.", ephemeral: true });
      return;
    }
    const guildId = interaction.guildId;
    const sub = interaction.options.getSubcommand(true);
    const platform = interaction.options.getString("platform", true) as Platform;

    if (sub === "set") {
      const template = interaction.options.getString("template", true);
      customizationRepo.setTemplate(guildId, platform, template);
      await interaction.reply({
        content:
          `Message **${labelOf(platform)}** mis à jour :\n> ${template}\n\n` +
          `Placeholders dispos : ${AVAILABLE_PLACEHOLDERS[platform].join(", ")}`,
        ephemeral: true,
      });
      return;
    }

    if (sub === "reset") {
      customizationRepo.resetTemplate(guildId, platform);
      await interaction.reply({
        content:
          `Message **${labelOf(platform)}** réinitialisé au défaut :\n> ${DEFAULT_TEMPLATES[platform]}`,
        ephemeral: true,
      });
      return;
    }

    if (sub === "show") {
      const custom = customizationRepo.get(guildId, platform);
      const current = custom?.template ?? DEFAULT_TEMPLATES[platform];
      const isCustom = Boolean(custom?.template);
      const note =
        "\n\n_Astuce : utilise `\\n` pour un saut de ligne dans ton template._" +
        "\n_Le ping de rôle et l'URL sont automatiquement ajoutés sur leur propre ligne._";
      await interaction.reply({
        content:
          `**Message ${labelOf(platform)}** ${isCustom ? "(personnalisé)" : "(défaut)"} :\n` +
          `> ${current.replace(/\n/g, "\n> ")}\n\n` +
          `**Placeholders disponibles :** ${AVAILABLE_PLACEHOLDERS[platform].join(", ")}` +
          note,
        ephemeral: true,
      });
    }
  },
};

function labelOf(p: Platform) {
  return p === "youtube" ? "YouTube" : p === "twitch" ? "Twitch" : "TikTok";
}
