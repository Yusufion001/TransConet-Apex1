import { prisma } from "../config/prisma.js";
import { publishAdminEvent } from "../realtime/realtime.service.js";

export async function getBackupRecoveryStatus() {
  const startedAt = Date.now();

  try {
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
      status: "READY" as const,
      database: "POSTGRESQL",
      provider: "SUPABASE",
      backupStrategy: "SUPABASE_MANAGED",
      recoveryMode: "POINT_IN_TIME_RECOVERY",
      physicalBackupManagedExternally: true,
      applicationSnapshotMode: "ADMINISTRATIVE_AUDIT_RECORD",
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
  } catch (error) {
    console.error("BACKUP_RECOVERY_STATUS_ERROR", error);
    return {
      status: "DEGRADED" as const,
      database: "POSTGRESQL",
      provider: "SUPABASE",
      backupStrategy: "SUPABASE_MANAGED",
      recoveryMode: "POINT_IN_TIME_RECOVERY",
      physicalBackupManagedExternally: true,
      applicationSnapshotMode: "ADMINISTRATIVE_AUDIT_RECORD",
      responseTimeMs: Date.now() - startedAt,
      protectedRecords: null,
      checkedAt: new Date(),
      error:
        error instanceof Error
          ? error.message
          : "Backup and recovery status check failed",
    };
  }
}

export async function createBackupSnapshotRecord(
  administratorId: string,
) {
  const requestedAt = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const snapshot = await tx.backupSnapshot.create({
      data: {
        administratorId,
        type: "ADMINISTRATIVE_SNAPSHOT",
        status: "REQUESTED",
        provider: "SUPABASE",
        requestedAt,
      },
    });

    const auditLog = await tx.auditLog.create({
      data: {
        administratorId,
        action: "BACKUP_SNAPSHOT_REQUESTED",
        previousValue: {
          backupStrategy: "SUPABASE_MANAGED",
          recoveryMode: "POINT_IN_TIME_RECOVERY",
        },
        newValue: {
          snapshotId: snapshot.id,
          type: snapshot.type,
          status: snapshot.status,
          provider: snapshot.provider,
          requestedAt: snapshot.requestedAt,
        },
      },
    });

    return { snapshot, auditLog };
  });

  const snapshot = {
    id: result.snapshot.id,
    type: result.snapshot.type,
    status: result.snapshot.status,
    requestedBy: administratorId,
    requestedAt: result.snapshot.requestedAt,
  };

  publishAdminEvent({
    eventType: "BACKUP_SNAPSHOT_REQUESTED",
    module: "BACKUP_RECOVERY",
    entityType: "BACKUP",
    entityId: result.snapshot.id,
    actorId: administratorId,
    data: {
      ...snapshot,
      auditLogId: result.auditLog.id,
    },
  });

  return {
    ...snapshot,
    auditLogId: result.auditLog.id,
  };
}
