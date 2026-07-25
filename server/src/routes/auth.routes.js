// @ts-check
const express = require("express");
const db = require("../db");
const config = require("../config");
const { hashPassword, verifyPassword } = require("../auth/password");
const { signToken } = require("../auth/jwt");
const { generateStreamKey } = require("../utils/streamKey");
const { isValidUsername, isValidEmail, isValidPassword } = require("../utils/validation");
const { requireAuth } = require("../middleware/auth.middleware");

const router = express.Router();

function toPublicProfile(user) {
  return {
    username: user.username,
    email: user.email,
    title: user.title,
    isLive: !!user.is_live,
    streamKey: user.stream_key,
    rtmpUrl: `rtmp://${config.publicHost || "<SERVER_IP>"}:${config.rtmpPort}/live`,
    rtmpStreamKey: `${user.username}?key=${user.stream_key}`,
    createdAt: user.created_at,
  };
}

router.post("/register", async (req, res) => {
  const { username, email, password } = req.body || {};

  if (!isValidUsername(username)) {
    return res.status(400).json({
      error: "Ungueltiger Benutzername (3-20 Zeichen, nur Kleinbuchstaben, Zahlen, - und _).",
    });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: "Ungueltige E-Mail-Adresse." });
  }
  if (!isValidPassword(password)) {
    return res.status(400).json({ error: "Das Passwort muss mindestens 6 Zeichen lang sein." });
  }

  if (db.getUserByUsername(username)) {
    return res.status(409).json({ error: "Dieser Benutzername ist bereits vergeben." });
  }
  if (db.getUserByEmail(email)) {
    return res.status(409).json({ error: "Diese E-Mail-Adresse wird bereits verwendet." });
  }

  const passwordHash = await hashPassword(password);
  const streamKey = generateStreamKey();
  const user = db.createUser({ username, email, passwordHash, streamKey });

  const token = signToken(user);
  res.status(201).json({ token, user: toPublicProfile(user) });
});

router.post("/login", async (req, res) => {
  const { username, password } = req.body || {};
  if (typeof username !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "Benutzername und Passwort erforderlich." });
  }

  const normalized = username.trim().toLowerCase();
  const user = db.getUserByUsername(normalized) || db.getUserByEmail(normalized);
  if (!user) {
    return res.status(401).json({ error: "Benutzername/E-Mail oder Passwort ist falsch." });
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: "Benutzername/E-Mail oder Passwort ist falsch." });
  }

  const token = signToken(user);
  res.json({ token, user: toPublicProfile(user) });
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: toPublicProfile(req.user) });
});

router.post("/stream-key/regenerate", requireAuth, (req, res) => {
  const newKey = generateStreamKey();
  db.updateStreamKey(req.user.username, newKey);
  const user = db.getUserByUsername(req.user.username);
  res.json({ user: toPublicProfile(user) });
});

module.exports = router;
