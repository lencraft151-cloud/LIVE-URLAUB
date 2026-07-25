// @ts-check
require("dotenv").config({ quiet: true });
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const nodeEnv = process.env.NODE_ENV || "development";

const jwtSecret = process.env.JWT_SECRET || "dev-insecure-secret-change-me";
if (nodeEnv === "production" && jwtSecret === "dev-insecure-secret-change-me") {
  console.warn(
    "[config] WARNUNG: JWT_SECRET wurde nicht gesetzt. Bitte in der .env eine eigene, " +
      "zufaellige JWT_SECRET fuer den Produktivbetrieb konfigurieren."
  );
}

module.exports = {
  nodeEnv,
  apiPort: parseInt(process.env.API_PORT || "4000", 10),
  rtmpPort: parseInt(process.env.RTMP_PORT || "1935", 10),
  mediaHttpPort: parseInt(process.env.MEDIA_HTTP_PORT || "8000", 10),
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "30d",
  corsOrigin: process.env.CORS_ORIGIN || "*",
  ffmpegPath: process.env.FFMPEG_PATH || "/usr/bin/ffmpeg",
  dbPath: process.env.DB_PATH || path.join(rootDir, "data", "app.db"),
  mediaRoot: process.env.MEDIA_ROOT || path.join(rootDir, "media"),
  chatHistoryLimit: parseInt(process.env.CHAT_HISTORY_LIMIT || "50", 10),
  publicHost: process.env.PUBLIC_HOST || "",
};
