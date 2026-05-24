import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { customizationRepo, type Platform } from "../../db/index.js";
import {
  DEFAULT_COLORS,
  formatHexColor,
  parseHexColor,
} from "../../services/template.js";
import type { SlashCommand } from "./types.js";

// Twitch uses Discord's native auto-embed, which forces Twitch's own purple — color customization
// doesn't apply there, so we omit it from the choices.
const PLATFORM_CHOICES = [
  { name: "YouTube", value: "youtube" },
  { name: "TikTok", value: "tiktok" },
] as const;

export const color: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("color")
    .setDescription("Personnaliser la couleur de l'embed par plateforme")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName("set")
        .setDescription("Définir une couleur personnalisée")
        .addStringOption((o) =>
          o
            .setName("platform")
            .setDescription("Plateforme")
            .setRequired(true)
            .addChoices(...PLATFORM_CHOICES),
        )
        .addStringOption((o) =>
          o
            .setName("hex")
            .setDescription("Code hex — ex: #ff5733 ou #f53")
            .setRequired(true)
            .setMaxLength(7),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("reset")
        .setDescription("Revenir à la couleur par défaut de la plateforme")
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
        .setDescription("Voir la couleur actuelle")
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
      const hex = interaction.options.getString("hex", true);
      const parsed = parseHexColor(hex);
      if (parsed === null) {
        await interaction.reply({
          content: `Code couleur invalide : \`${hex}\`. Utilise un format hex (ex: \`#ff5733\` ou \`#f53\`).`,
          ephemeral: true,
        });
        return;
      }
      customizationRepo.setColor(guildId, platform, parsed);
      await interaction.reply({
        content: `Couleur **${labelOf(platform)}** mise à jour : \`${formatHexColor(parsed)}\``,
        ephemeral: true,
      });
      return;
    }

    if (sub === "reset") {
      customizationRepo.resetColor(guildId, platform);
      await interaction.reply({
        content:
          `Couleur **${labelOf(platform)}** réinitialisée au défaut : \`${formatHexColor(DEFAULT_COLORS[platform])}\``,
        ephemeral: true,
      });
      return;
    }

    if (sub === "show") {
      const custom = customizationRepo.get(guildId, platform);
      const current = custom?.color ?? DEFAULT_COLORS[platform];
      const isCustom = custom?.color != null;
      await interaction.reply({
        content:
          `**Couleur ${labelOf(platform)}** ${isCustom ? "(personnalisée)" : "(défaut)"} : \`${formatHexColor(current)}\``,
        ephemeral: true,
      });
    }
  },
};

function labelOf(p: Platform) {
  return p === "youtube" ? "YouTube" : p === "twitch" ? "Twitch" : "TikTok";
}
