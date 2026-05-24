import { Client, GatewayIntentBits, Partials } from "discord.js";
import { config } from "../config.js";

export const client = new Client({
  intents: [GatewayIntentBits.Guilds],
  partials: [Partials.Channel],
});

export async function login() {
  await client.login(config.DISCORD_TOKEN);
}
