// @ts-check
const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const config = require("./config");
const authRoutes = require("./routes/auth.routes");
const channelsRoutes = require("./routes/channels.routes");
const { registerChatSocket } = require("./sockets/chat.socket");
const { createMediaServer } = require("./media/nms");

const app = express();
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json({ limit: "10kb" }));

app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "live-urlaub-server" });
});
app.use("/api/auth", authRoutes);
app.use("/api/channels", channelsRoutes);

app.use((req, res) => {
  res.status(404).json({ error: "Nicht gefunden." });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error("[api] Unerwarteter Fehler:", err);
  res.status(500).json({ error: "Interner Serverfehler." });
});

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: config.corsOrigin },
});
registerChatSocket(io);

const nms = createMediaServer(io);
nms.run();

httpServer.listen(config.apiPort, () => {
  console.log("");
  console.log("=== LIVE-URLAUB Server ===");
  console.log(`API + Chat (Socket.io):  http://localhost:${config.apiPort}`);
  console.log(`RTMP Ingest (Publish):   rtmp://localhost:${config.rtmpPort}/live/<username>?key=<streamKey>`);
  console.log(`HLS Wiedergabe:          http://localhost:${config.mediaHttpPort}/live/<username>/index.m3u8`);
  console.log("===========================");
  console.log("");
});

function shutdown() {
  console.log("\n[server] Fahre herunter...");
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
