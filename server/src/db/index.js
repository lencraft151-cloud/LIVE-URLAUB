// @ts-check
const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const config = require("../config");

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });

const db = new Database(config.dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    stream_key TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    is_live INTEGER NOT NULL DEFAULT 0,
    live_started_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel TEXT NOT NULL,
    username TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_chat_channel_id ON chat_messages(channel, id);
`);

const PUBLIC_USER_FIELDS = "username, title, is_live AS isLive, live_started_at AS liveStartedAt, created_at AS createdAt";

const statements = {
  insertUser: db.prepare(
    `INSERT INTO users (username, email, password_hash, stream_key) VALUES (@username, @email, @passwordHash, @streamKey)`
  ),
  getUserByUsername: db.prepare(`SELECT * FROM users WHERE username = ?`),
  getUserByEmail: db.prepare(`SELECT * FROM users WHERE email = ?`),
  getUserById: db.prepare(`SELECT * FROM users WHERE id = ?`),
  updateStreamKey: db.prepare(`UPDATE users SET stream_key = ? WHERE username = ?`),
  updateTitle: db.prepare(`UPDATE users SET title = ? WHERE username = ?`),
  setLiveStatus: db.prepare(
    `UPDATE users SET is_live = ?, live_started_at = CASE WHEN ? = 1 THEN datetime('now') ELSE live_started_at END WHERE username = ?`
  ),
  listChannels: db.prepare(
    `SELECT ${PUBLIC_USER_FIELDS} FROM users ORDER BY is_live DESC, live_started_at DESC, username ASC`
  ),
  getChannel: db.prepare(`SELECT ${PUBLIC_USER_FIELDS} FROM users WHERE username = ?`),
  insertChatMessage: db.prepare(
    `INSERT INTO chat_messages (channel, username, message) VALUES (@channel, @username, @message)`
  ),
  getRecentMessages: db.prepare(
    `SELECT username, message, created_at AS createdAt FROM chat_messages WHERE channel = ? ORDER BY id DESC LIMIT ?`
  ),
};

module.exports = {
  raw: db,

  createUser({ username, email, passwordHash, streamKey }) {
    const info = statements.insertUser.run({ username, email, passwordHash, streamKey });
    return statements.getUserById.get(info.lastInsertRowid);
  },

  getUserByUsername(username) {
    return statements.getUserByUsername.get(username);
  },

  getUserByEmail(email) {
    return statements.getUserByEmail.get(email);
  },

  getUserById(id) {
    return statements.getUserById.get(id);
  },

  updateStreamKey(username, newKey) {
    statements.updateStreamKey.run(newKey, username);
  },

  updateTitle(username, title) {
    statements.updateTitle.run(title, username);
  },

  setLiveStatus(username, isLive) {
    statements.setLiveStatus.run(isLive ? 1 : 0, isLive ? 1 : 0, username);
  },

  listChannels() {
    return statements.listChannels.all().map((row) => ({ ...row, isLive: !!row.isLive }));
  },

  getChannel(username) {
    const row = statements.getChannel.get(username);
    return row ? { ...row, isLive: !!row.isLive } : undefined;
  },

  insertChatMessage({ channel, username, message }) {
    statements.insertChatMessage.run({ channel, username, message });
  },

  getRecentMessages(channel, limit) {
    return statements.getRecentMessages.all(channel, limit).reverse();
  },
};
