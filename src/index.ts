import { client, login } from "./bot/client.js";
import { registerInteractionHandler } from "./bot/commands/index.js";
import { startScheduler } from "./scheduler.js";

async function main() {
  registerInteractionHandler();

  client.once("clientReady", (c) => {
    console.log(`Logged in as ${c.user.tag} — serving ${c.guilds.cache.size} guild(s).`);
    startScheduler();
  });

  client.on("error", (err) => console.error("[discord]", err));
  process.on("unhandledRejection", (err) => console.error("[unhandledRejection]", err));
  process.on("uncaughtException", (err) => console.error("[uncaughtException]", err));

  await login();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
