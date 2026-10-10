import type { Server } from "socket.io";

let socketServer: Server | undefined;

/**
 * Register the existing Socket.IO server so administrator changes can
 * revoke connections after their database transaction has committed.
 */
export function registerAdminSocketServer(io: Server): void {
  socketServer = io;
}

/**
 * Disconnect every socket authenticated as this user. The existing
 * authentication middleware reloads current account and admin permissions
 * on the next connection.
 */
export function revokeAdminSocketAccess(userId: string): void {
  if (!socketServer || !userId) return;

  socketServer.in(`user:${userId}`).disconnectSockets(true);
}
