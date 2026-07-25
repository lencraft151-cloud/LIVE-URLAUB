// @ts-check
require("dotenv").config({ quiet: true });
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const nodeEnv = process.env.NODE_ENV || "development";

const DEV_SECRET = "dev-insecure-secret-change-me";
// Platzhalter aus den mitgelieferten Beispieldateien - die duerfen produktiv nie durchrutschen.
const PLACEHOLDER_SECRETS = [
  DEV_SECRET,
  "change-me-to-a-long-random-string",
  "please-change-this-secret",
];

const jwtSecret = process.env.JWT_SECRET || DEV_SECRET;

// Oeffentlich erreichbare Instanz mit bekanntem Secret = jeder kann sich fremde
// Logins ausstellen. Deshalb hier hart abbrechen statt nur warnen.
if (nodeEnv === "production" && (PLACEHOLDER_SECRETS.includes(jwtSecret) || jwtSecret.length < 16)) {
  console.error(
    "\n[config] FEHLER: Unsicheres JWT_SECRET im Produktivbetrieb.\n" +
      "Bitte einen eigenen, zufaelligen Wert (mind. 16 Zeichen) setzen, z.B.:\n" +
      "  openssl rand -hex 32\n" +
      "und ihn als JWT_SECRET in die .env eintragen.\n"
  );
  process.exit(1);
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
