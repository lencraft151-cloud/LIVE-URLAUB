import { API_URL } from "./config";

const TOKEN_KEY = "live-urlaub-token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

async function request(path, { method = "GET", body, auth = false } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    throw new Error(data?.error || `Anfrage fehlgeschlagen (${res.status})`);
  }
  return data;
}

export const api = {
  register: (payload) => request("/api/auth/register", { method: "POST", body: payload }),
  login: (payload) => request("/api/auth/login", { method: "POST", body: payload }),
  me: () => request("/api/auth/me", { auth: true }),
  regenerateStreamKey: () => request("/api/auth/stream-key/regenerate", { method: "POST", auth: true }),
  listChannels: () => request("/api/channels"),
  getChannel: (username) => request(`/api/channels/${encodeURIComponent(username)}`),
  updateTitle: (title) => request("/api/channels/me", { method: "PATCH", body: { title }, auth: true }),
};
