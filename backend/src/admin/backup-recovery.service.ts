import { prisma } from "../config/prisma.js";
import { publishAdminEvent } from "../realtime/realtime.service.js";

export async function getBackupRecoveryStatus() {
  const startedAt = Date.now();

  const [
    users,
    bookings,
    payments,
    vehicles,
    documents,
    auditLogs,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.booking.count(),
    prisma.payment.count(),
    prisma.vehicle.count(),
    prisma.document.count(),
    prisma.auditLog.count(),
  ]);

  return {
    status: "READY",
    database: "POSTGRESQL",
    backupStrategy: "SUPABASE_MANAGED",
    recoveryMode: "POINT_IN_TIME_RECOVERY",
    responseTimeMs: Date.now() - startedAt,
    protectedRecords: {
      users,
      bookings,
      payments,
      vehicles,
      documents,
      auditLogs,
    },
    checkedAt: new Date(),
  };
}

export async function createBackupSnapshotRecord(
  administratorId: string,
) {
  const snapshot = {
    id: crypto.randomUUID(),
    type: "ADMINISTRATIVE_SNAPSHOT",
    status: "REQUESTED",
    requestedBy: administratorId,
    requestedAt: new Date(),
  };

  publishAdminEvent({
    eventType: "BACKUP_SNAPSHOT_REQUESTED",
    module: "BACKUP_RECOVERY",
    entityType: "BACKUP",
    entityId: snapshot.id,
    actorId: administratorId,
    data: snapshot,
  });

  return snapshot;
}
