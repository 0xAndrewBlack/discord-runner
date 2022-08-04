/* eslint-disable no-unused-vars */
import * as dotenv from "dotenv";

dotenv.config();

const nodeEnv = process.env.NODE_ENV || "development";

const redisHost = process.env.REDIS_HOST;
const discordToken = process.env.DISCORD_TOKEN;
const backendUrl = process.env.BACKEND_URL;
const api = {
  prefix: "/api",
  port: process.env.PORT || 8990,
};
const embedColor = {
  default: process.env.EMBED_COLOR || "6366f1",
  error: "ff0000",
};
const guildUrl = process.env.GUILD_URL;

const joinButtonEmojis = {
  emoji1: process.env.JOIN_BUTTON_EMOJI1 || "🖤",
  emoji2: process.env.JOIN_BUTTON_EMOJI2 || "🤍",
};

if (!discordToken) {
  throw new Error(
    "You need to specify the bot's DISCORD_TOKEN in the .env file."
  );
}

if (!backendUrl) {
  throw new Error("You need to specify the BACKEND_URL in the .env file.");
}

if (!redisHost) {
  throw new Error("You need to specify the REDIS_HOST in the .env file.");
}

export default {
  nodeEnv,
  redisHost,
  discordToken,
  backendUrl,
  api,
  platform: "DISCORD",
  embedColor,
  guildUrl,
  joinButtonEmojis,
};
