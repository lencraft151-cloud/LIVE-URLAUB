// @ts-check
const { verifyToken } = require("../auth/jwt");
const db = require("../db");

function getTokenFromHeader(req) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme === "Bearer" && token) return token;
  return null;
}

function requireAuth(req, res, next) {
  const token = getTokenFromHeader(req);
  if (!token) {
    return res.status(401).json({ error: "Anmeldung erforderlich." });
  }
  try {
    const payload = verifyToken(token);
    const user = db.getUserById(payload.sub);
    if (!user) {
      return res.status(401).json({ error: "Benutzer nicht gefunden." });
    }
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: "Ungueltiges oder abgelaufenes Token." });
  }
}

module.exports = { requireAuth, getTokenFromHeader };
