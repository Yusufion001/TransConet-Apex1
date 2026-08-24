import { io, type Socket } from "socket.io-client";
import Constants from "expo-constants";
import { getAccessToken } from "../storage/auth-storage";

const extra = Constants.expoConfig?.extra as
  | { apiUrl?: string }
  | undefined;

const apiUrl =
  extra?.apiUrl ??
  process.env.EXPO_PUBLIC_API_URL ??
  "http://127.0.0.1:4000/api";

const socketUrl = apiUrl.replace(/\/api\/?$/, "");

let socket: Socket | null = null;

export async function getRealtimeSocket(): Promise<Socket> {
  const token = await getAccessToken();

  if (!token) {
    throw new Error("Authentication required for realtime connection");
  }

  if (socket) {
    socket.auth = { token };
    if (!socket.connected) socket.connect();
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

export async function refreshRealtimeAuthentication() {
  if (!socket) return;

  const token = await getAccessToken();

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

export function disconnectRealtimeSocket() {
  socket?.disconnect();
  socket = null;
}
