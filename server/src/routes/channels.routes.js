// @ts-check
const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth.middleware");

const router = express.Router();

function toChannelDto(channel) {
  return {
    username: channel.username,
    title: channel.title,
    isLive: channel.isLive,
    liveStartedAt: channel.liveStartedAt,
    hlsPath: `/live/${channel.username}/index.m3u8`,
  };
}

router.get("/", (req, res) => {
  const channels = db.listChannels().map(toChannelDto);
  res.json({ channels });
});

router.get("/:username", (req, res) => {
  const channel = db.getChannel(req.params.username.toLowerCase());
  if (!channel) {
    return res.status(404).json({ error: "Kanal nicht gefunden." });
  }
  res.json({ channel: toChannelDto(channel) });
});

router.patch("/me", requireAuth, (req, res) => {
  const { title } = req.body || {};
  if (typeof title !== "string" || title.length > 100) {
    return res.status(400).json({ error: "Der Titel darf maximal 100 Zeichen lang sein." });
  }
  db.updateTitle(req.user.username, title.trim());
  const channel = db.getChannel(req.user.username);
  res.json({ channel: toChannelDto(channel) });
});

module.exports = router;
