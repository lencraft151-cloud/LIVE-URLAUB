// @ts-check
const { verifyToken } = require("../auth/jwt");
const db = require("../db");
const config = require("../config");
const { isValidUsername } = require("../utils/validation");

const MAX_MESSAGE_LENGTH = 300;
const MIN_MESSAGE_INTERVAL_MS = 400;

const room = (channel) => `chat:${channel}`;

function broadcastViewerCount(io, channel) {
  const size = io.sockets.adapter.rooms.get(room(channel))?.size || 0;
  io.to(room(channel)).emit("chat:viewers", { channel, count: size });
}

function registerChatSocket(io) {
  io.use((socket, next) => {
    const token = socket.handshake.auth && socket.handshake.auth.token;
    if (token) {
      try {
        const payload = verifyToken(token);
        const user = db.getUserById(payload.sub);
        if (user) {
          socket.data.user = { username: user.username };
        }
      } catch {
        // Ungueltiges Token -> Verbindung bleibt anonym (nur Zuschauer, kein Chat-Schreibrecht).
      }
    }
    next();
  });

  io.on("connection", (socket) => {
    let joinedChannel = null;
    let lastMessageAt = 0;

    socket.on("chat:join", (payload) => {
      const channel =
        payload && typeof payload.channel === "string" ? payload.channel.trim().toLowerCase() : "";
      if (!isValidUsername(channel) || !db.getUserByUsername(channel)) return;

      const previousChannel = joinedChannel;
      if (previousChannel && previousChannel !== channel) {
        socket.leave(room(previousChannel));
      }
      joinedChannel = channel;
      socket.join(room(channel));

      socket.emit("chat:history", {
        channel,
        messages: db.getRecentMessages(channel, config.chatHistoryLimit),
      });

      broadcastViewerCount(io, channel);
      if (previousChannel && previousChannel !== channel) {
        broadcastViewerCount(io, previousChannel);
      }
    });

    socket.on("chat:leave", () => {
      if (!joinedChannel) return;
      const channel = joinedChannel;
      socket.leave(room(channel));
      joinedChannel = null;
      broadcastViewerCount(io, channel);
    });

    socket.on("chat:message", (payload) => {
      if (!joinedChannel) return;
      if (!socket.data.user) {
        socket.emit("chat:error", { error: "Bitte melde dich an, um zu chatten." });
        return;
      }

      const now = Date.now();
      if (now - lastMessageAt < MIN_MESSAGE_INTERVAL_MS) return;

      const text = payload && typeof payload.text === "string" ? payload.text.trim() : "";
      if (!text || text.length > MAX_MESSAGE_LENGTH) return;
      lastMessageAt = now;

      const message = {
        channel: joinedChannel,
        username: socket.data.user.username,
        message: text,
        createdAt: new Date().toISOString(),
      };
      db.insertChatMessage(message);
      io.to(room(joinedChannel)).emit("chat:message", message);
    });

    socket.on("disconnect", () => {
      if (joinedChannel) {
        broadcastViewerCount(io, joinedChannel);
      }
    });
  });
}

module.exports = { registerChatSocket };
