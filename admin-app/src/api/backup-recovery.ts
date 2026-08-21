import { apiClient } from "./client";

export interface BackupRecoveryStatus {
  status: "READY" | "DEGRADED" | string;
  database: string;
  provider: string;
  backupStrategy: string;
  recoveryMode: string;
  physicalBackupManagedExternally: boolean;
  applicationSnapshotMode: string;
  responseTimeMs: number;
  protectedRecords: {
    users: number;
    bookings: number;
    payments: number;
    vehicles: number;
    documents: number;
    auditLogs: number;
  } | null;
  checkedAt: string;
  error?: string;
}

export interface BackupSnapshot {
  id: string;
  type: string;
  status: string;
  requestedBy: string;
  requestedAt: string;
  auditLogId: string;
}

export async function getBackupRecoveryStatus(): Promise<BackupRecoveryStatus> {
  const response = await apiClient.get("/admin/backup-recovery");
  return response.data.data;
}

export async function requestBackupSnapshot(): Promise<BackupSnapshot> {
  const response = await apiClient.post(
    "/admin/backup-recovery/snapshot",
    {},
  );

  return response.data.data;
}
