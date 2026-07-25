const { protocol, hostname } = window.location;

// Produktion: Alles laeuft ueber denselben Origin, weil der Reverse Proxy (Caddy)
// /api, /socket.io und /live an die Backend-Dienste weiterreicht. Relative URLs sind
// hier zwingend - mit festen Ports wie :4000 wuerde der Browser die Anfragen auf einer
// HTTPS-Seite als Mixed Content blockieren.
//
// Entwicklung: Vite laeuft auf :5173, das Backend separat auf :4000 / :8000.
//
// Die VITE_-Variablen braucht man nur, wenn API/Medien auf einer ANDEREN Domain liegen.
const devApi = `${protocol}//${hostname}:4000`;
const devMedia = `${protocol}//${hostname}:8000`;

export const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? devApi : "");
export const MEDIA_URL = import.meta.env.VITE_MEDIA_URL || (import.meta.env.DEV ? devMedia : "");

// Socket.io braucht eine absolute URL; leerer API_URL bedeutet "gleicher Origin".
export const SOCKET_URL = API_URL || window.location.origin;
