import { io, type Socket } from "socket.io-client";

const configuredApiUrl = import.meta.env.VITE_API_URL;
const apiUrl = configuredApiUrl?.trim().replace(/\/$/, "");

if (!apiUrl) {
  throw new Error(
    "TransConet Admin API URL is not configured. Set VITE_API_URL before building the Admin app.",
  );
}

const socketUrl = apiUrl.replace(/\/api\/?$/, "");

const ACCESS_TOKEN_KEY = "transconet_admin_access_token";

let socket: Socket | null = null;

function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getAdminRealtimeSocket(): Socket | null {
  const token = getAccessToken();

  if (!token) {
    return null;
  }

  if (socket) {
    socket.auth = { token };

    if (!socket.connected) {
      socket.connect();
    }

    return socket;
  }

  socket = io(socketUrl, {
    autoConnect: false,
    transports: ["websocket"],
    auth: { token },
  });

  socket.connect();

  return socket;
}

export function refreshAdminRealtimeAuthentication() {
  if (!socket) return;

  const token = getAccessToken();

  if (!token) {
    socket.disconnect();
    return;
  }

  socket.auth = { token };

  if (socket.connected) {
    socket.disconnect();
  }

  socket.connect();
}

export function disconnectAdminRealtimeSocket() {
  socket?.disconnect();
  socket = null;
}
