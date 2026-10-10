import test from "node:test";
import assert from "node:assert/strict";
import {
  registerAdminSocketServer,
  revokeAdminSocketAccess,
} from "../src/realtime/admin-socket-access.js";

test("revokes all sockets in the affected user's room", () => {
  const calls: Array<{ room: string; close: boolean }> = [];
  const fakeIo = {
    in(room: string) {
      return {
        disconnectSockets(close: boolean) {
          calls.push({ room, close });
        },
      };
    },
  };

  registerAdminSocketServer(fakeIo as any);
  revokeAdminSocketAccess("admin-user-1");

  assert.deepEqual(calls, [
    { room: "user:admin-user-1", close: true },
  ]);
});

test("does not attempt revocation for an empty user ID", () => {
  const calls: string[] = [];
  const fakeIo = {
    in(room: string) {
      calls.push(room);
      return { disconnectSockets() {} };
    },
  };

  registerAdminSocketServer(fakeIo as any);
  revokeAdminSocketAccess("");

  assert.deepEqual(calls, []);
});
