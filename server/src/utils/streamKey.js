// @ts-check
const crypto = require("crypto");

function generateStreamKey() {
  return crypto.randomBytes(20).toString("hex");
}

function safeCompare(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length === 0 || b.length === 0) {
    return false;
  }
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

module.exports = { generateStreamKey, safeCompare };
