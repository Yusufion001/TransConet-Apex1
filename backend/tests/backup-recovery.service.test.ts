import { mock } from "node:test";
import assert from "node:assert/strict";
import test from "node:test";

const auditLogCreate = mock.fn(async ({ data }: any) => ({
  id: "audit-1",
  ...data,
}));

const counts = {
  user: mock.fn(async () => 10),
  booking: mock.fn(async () => 20),
  payment: mock.fn(async () => 30),
  vehicle: mock.fn(async () => 40),
  document: mock.fn(async () => 50),
  auditLog: {
    count: mock.fn(async () => 60),
    create: auditLogCreate,
  },
};

const backupSnapshotCreate = mock.fn(async ({ data }: any) => ({
  id: "snapshot-1",
  ...data,
}));

const transaction = mock.fn(async (callback: any) =>
  callback({
    backupSnapshot: {
      create: backupSnapshotCreate,
    },
    auditLog: {
      create: auditLogCreate,
    },
  }),
);

mock.module("../src/config/prisma.js", {
  namedExports: {
    prisma: {
      user: { count: counts.user },
      booking: { count: counts.booking },
      payment: { count: counts.payment },
      vehicle: { count: counts.vehicle },
      document: { count: counts.document },
      auditLog: counts.auditLog,
      $transaction: transaction,
    },
  },
});

const publishAdminEvent = mock.fn();

mock.module("../src/realtime/realtime.service.js", {
  namedExports: {
    publishAdminEvent,
  },
});

const {
  getBackupRecoveryStatus,
  createBackupSnapshotRecord,
} = await import("../src/admin/backup-recovery.service.js");

test("getBackupRecoveryStatus reports protected records and Supabase recovery strategy", async () => {
  const result = await getBackupRecoveryStatus();

  assert.equal(result.status, "READY");
  assert.equal(result.database, "POSTGRESQL");
  assert.equal(result.provider, "SUPABASE");
  assert.equal(result.backupStrategy, "SUPABASE_MANAGED");
  assert.equal(result.recoveryMode, "POINT_IN_TIME_RECOVERY");
  assert.equal(result.physicalBackupManagedExternally, true);
  assert.deepEqual(result.protectedRecords, {
    users: 10,
    bookings: 20,
    payments: 30,
    vehicles: 40,
    documents: 50,
    auditLogs: 60,
  });
});

test("createBackupSnapshotRecord creates an audit record and publishes realtime event", async () => {
  const result = await createBackupSnapshotRecord("admin-1");

  assert.equal(result.status, "REQUESTED");
  assert.equal(result.requestedBy, "admin-1");
  assert.equal(result.auditLogId, "audit-1");

  assert.equal(transaction.mock.callCount(), 1);
  assert.equal(backupSnapshotCreate.mock.callCount(), 1);
  assert.equal(auditLogCreate.mock.callCount(), 1);
  assert.equal(auditLogCreate.mock.calls[0].arguments[0].data.administratorId, "admin-1");
  assert.equal(
    auditLogCreate.mock.calls[0].arguments[0].data.action,
    "BACKUP_SNAPSHOT_REQUESTED",
  );

  assert.equal(publishAdminEvent.mock.callCount(), 1);
  assert.equal(
    publishAdminEvent.mock.calls[0].arguments[0].eventType,
    "BACKUP_SNAPSHOT_REQUESTED",
  );
});
