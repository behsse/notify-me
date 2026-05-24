import { REST, Routes } from "discord.js";
import { config } from "../config.js";
import { commands } from "./commands/index.js";

async function main() {
  const rest = new REST({ version: "10" }).setToken(config.DISCORD_TOKEN);
  const body = commands.map((c) => c.data.toJSON());

  if (config.DISCORD_GUILD_ID) {
    console.log(`Registering ${body.length} guild commands on ${config.DISCORD_GUILD_ID}…`);
    await rest.put(
      Routes.applicationGuildCommands(config.DISCORD_CLIENT_ID, config.DISCORD_GUILD_ID),
      { body },
    );
  } else {
    console.log(`Registering ${body.length} global commands…`);
    await rest.put(Routes.applicationCommands(config.DISCORD_CLIENT_ID), { body });
  }

  console.log("Slash commands registered.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
