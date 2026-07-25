// @ts-check
const NodeMediaServer = require("node-media-server");
const fs = require("fs");
const config = require("../config");
const db = require("../db");
const { safeCompare } = require("../utils/streamKey");

fs.mkdirSync(config.mediaRoot, { recursive: true });

/** Parses "/live/<username>" into the username, or null if the shape doesn't match. */
function usernameFromStreamPath(streamPath) {
  const parts = String(streamPath || "")
    .split("/")
    .filter(Boolean);
  if (parts.length !== 2 || parts[0] !== "live") return null;
  return parts[1].toLowerCase();
}

function createMediaServer(io) {
  const nms = new NodeMediaServer({
    logType: config.nodeEnv === "production" ? 1 : 2,
    rtmp: {
      port: config.rtmpPort,
      chunk_size: 60000,
      gop_cache: true,
      ping: 30,
      ping_timeout: 60,
    },
    http: {
      port: config.mediaHttpPort,
      mediaroot: config.mediaRoot,
      allow_origin: "*",
    },
    trans: {
      ffmpeg: config.ffmpegPath,
      tasks: [
        {
          app: "live",
          hls: true,
          hlsFlags: "[hls_time=2:hls_list_size=5:hls_flags=delete_segments+append_list]",
          hlsKeep: false,
        },
      ],
    },
  });

  // Publizieren erfordert einen gueltigen Stream-Key: rtmp://host:1935/live/<username>?key=<streamKey>
  // Der Stream-Key bleibt so privat - Zuschauer sehen fuer die Wiedergabe nur den (oeffentlichen) Benutzernamen.
  nms.on("prePublish", (id, streamPath, args) => {
    const session = nms.getSession(id);
    const username = usernameFromStreamPath(streamPath);
    const user = username ? db.getUserByUsername(username) : null;

    if (!user || !safeCompare(user.stream_key, args.key)) {
      console.warn(`[rtmp] Publizierungsversuch abgelehnt fuer Pfad "${streamPath}"`);
      session.reject();
      return;
    }
  });

  nms.on("postPublish", (id, streamPath) => {
    const username = usernameFromStreamPath(streamPath);
    if (!username || !db.getUserByUsername(username)) return;

    db.setLiveStatus(username, true);
    const channel = db.getChannel(username);
    console.log(`[rtmp] ${username} ist jetzt LIVE`);
    io.emit("channel:online", { username, liveStartedAt: channel.liveStartedAt });
  });

  nms.on("donePublish", (id, streamPath) => {
    const username = usernameFromStreamPath(streamPath);
    if (!username || !db.getUserByUsername(username)) return;

    db.setLiveStatus(username, false);
    console.log(`[rtmp] ${username} hat den Stream beendet`);
    io.emit("channel:offline", { username });
  });

  return nms;
}

module.exports = { createMediaServer };
