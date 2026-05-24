import { Collection, type Interaction } from "discord.js";
import { client } from "../client.js";
import { setchannel } from "./setchannel.js";
import { status } from "./status.js";
import { tiktok } from "./tiktok.js";
import { twitch } from "./twitch.js";
import type { SlashCommand } from "./types.js";
import { youtube } from "./youtube.js";

export const commands: SlashCommand[] = [setchannel, status, youtube, twitch, tiktok];

const byName = new Collection<string, SlashCommand>(
  commands.map((c) => [c.data.name, c]),
);

export function registerInteractionHandler() {
  client.on("interactionCreate", async (interaction: Interaction) => {
    if (!interaction.isChatInputCommand()) return;
    const command = byName.get(interaction.commandName);
    if (!command) return;
    try {
      await command.execute(interaction);
    } catch (err) {
      console.error(`[command:${interaction.commandName}]`, err);
      const message = "Something went wrong while running this command.";
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content: message, ephemeral: true }).catch(() => {});
      } else {
        await interaction.reply({ content: message, ephemeral: true }).catch(() => {});
      }
    }
  });
}
