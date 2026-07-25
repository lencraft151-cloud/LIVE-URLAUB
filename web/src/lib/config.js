const { protocol, hostname } = window.location;

// Ohne explizite VITE_-Overrides wird die URL aus dem aktuellen Host abgeleitet.
// Das funktioniert automatisch im LAN/Docker-Setup, egal ob per localhost, IP oder Domain zugegriffen wird.
export const API_URL = import.meta.env.VITE_API_URL || `${protocol}//${hostname}:4000`;
export const MEDIA_URL = import.meta.env.VITE_MEDIA_URL || `${protocol}//${hostname}:8000`;
