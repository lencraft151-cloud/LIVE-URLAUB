// @ts-check

const USERNAME_RE = /^[a-z0-9_-]{3,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidUsername(value) {
  return typeof value === "string" && USERNAME_RE.test(value);
}

function isValidEmail(value) {
  return typeof value === "string" && value.length <= 254 && EMAIL_RE.test(value);
}

function isValidPassword(value) {
  return typeof value === "string" && value.length >= 6 && value.length <= 200;
}

module.exports = { isValidUsername, isValidEmail, isValidPassword, USERNAME_RE };
