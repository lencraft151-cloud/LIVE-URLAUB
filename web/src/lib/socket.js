import { io } from "socket.io-client";
import { API_URL } from "./config";
import { getToken } from "./api";

let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io(API_URL, {
      autoConnect: false,
      auth: (cb) => cb({ token: getToken() }),
    });
  }
  return socket;
}

/** Nach Login/Logout aufrufen, damit die naechste Verbindung den aktuellen Token verwendet. */
export function reconnectSocket() {
  const s = getSocket();
  if (s.connected) {
    s.disconnect();
  }
  s.connect();
}
