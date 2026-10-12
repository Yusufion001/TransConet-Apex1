import { io, type Socket } from "socket.io-client";
import Constants from "expo-constants";
import { getAccessToken } from "../storage/auth-storage";

const extra = Constants.expoConfig?.extra as
  | { apiUrl?: string }
  | undefined;

const configuredApiUrl =
  extra?.apiUrl ??
  process.env.EXPO_PUBLIC_API_URL;

const apiUrl = configuredApiUrl?.trim().replace(/\/$/, "");

if (!apiUrl) {
  throw new Error(
    "TransConet API URL is not configured. Set EXPO_PUBLIC_API_URL before starting or building the mobile app.",
  );
}

const socketUrl = apiUrl.replace(/\/api\/?$/, "");

let socket: Socket | null = null;

function waitForSocketConnection(
  target: Socket,
  timeoutMs = 10000,
): Promise<void> {
  if (target.connected) return Promise.resolve();

  return new Promise<void>((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      clearTimeout(timer);
      target.off("connect", onConnect);
      target.off("connect_error", onConnectError);
    };

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      cleanup();

      if (error) {
        reject(
          new Error(
            `Realtime connection failed: ${error.message}`,
          ),
        );
      } else {
        resolve();
      }
    };

    const onConnect = () => finish();
    const onConnectError = (error: Error) => finish(error);

    const timer = setTimeout(
      () => finish(new Error("Connection timed out after 10 seconds")),
      timeoutMs,
    );

    target.once("connect", onConnect);
    target.on("connect_error", onConnectError);

    if (target.connected) finish();
  });
}

export async function getRealtimeSocket(): Promise<Socket> {
  const token = await getAccessToken();

  if (!token) {
    throw new Error("Authentication required for realtime connection");
  }

  if (socket) {
    socket.auth = { token };

    if (!socket.connected) socket.connect();

    await waitForSocketConnection(socket);
    return socket;
  }

  socket = io(socketUrl, {
    autoConnect: false,
    transports: ["websocket"],
    auth: { token },
  });

  socket.connect();
  await waitForSocketConnection(socket);

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
