import { useCallback, useEffect, useState } from "react";
import {
  getBackupRecoveryStatus,
  requestBackupSnapshot,
  type BackupRecoveryStatus,
  type BackupSnapshot,
} from "../api/backup-recovery";

function formatDate(value?: string) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString();
}

function statusClass(value?: string) {
  return value?.toUpperCase() === "READY"
    ? "status-active"
    : "status-warning";
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

export default function BackupRecovery() {
  const [status, setStatus] =
    useState<BackupRecoveryStatus | null>(null);

  const [snapshot, setSnapshot] =
    useState<BackupSnapshot | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");

  const loadStatus = useCallback(async (refresh = false) => {
    try {
      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");
      setActionMessage("");

      const data = await getBackupRecoveryStatus();
      setStatus(data);
    } catch {
      setError(
        "Unable to load Backup & Recovery status. Verify that your administrator account has BACKUP_RECOVERY permission.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  async function handleSnapshotRequest() {
    try {
      setRequesting(true);
      setError("");
      setActionMessage("");

      const result = await requestBackupSnapshot();

      setSnapshot(result);
      setActionMessage(
        `Administrative snapshot request ${result.id} was created successfully.`,
      );
    } catch {
      setError(
        "Unable to request the administrative snapshot.",
      );
    } finally {
      setRequesting(false);
    }
  }

  if (loading) {
    return (
      <section className="module-workspace">
        <div className="module-header">
          <div>
            <span className="module-kicker">
              TRANSCONET-APEX1 SYSTEM
            </span>
            <h2>Backup & Recovery</h2>
            <p>
              Monitor backup protection and recovery readiness.
            </p>
          </div>
        </div>

        <div className="panel customer-state">
          <strong>Loading Backup & Recovery…</strong>
          <span>
            Checking database protection and recovery status.
          </span>
        </div>
      </section>
    );
  }

  const records = status?.protectedRecords;

  return (
    <section className="module-workspace">
      <div className="module-header">
        <div>
          <span className="module-kicker">
            TRANSCONET-APEX1 SYSTEM
          </span>

          <h2>Backup & Recovery</h2>

          <p>
            Monitor database protection, recovery readiness,
            and administrative snapshot requests.
          </p>
        </div>

        <button
          type="button"
          className="text-button"
          onClick={() => void loadStatus(true)}
          disabled={refreshing}
        >
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="panel customer-state error-state">
          <strong>Backup & Recovery unavailable</strong>
          <span>{error}</span>
        </div>
      )}

      {actionMessage && (
        <div className="panel customer-state">
          <strong>Snapshot request recorded</strong>
          <span>{actionMessage}</span>
        </div>
      )}

      <section className="stats-grid">
        <Metric
          label="Recovery Status"
          value={status?.status ?? "—"}
          detail="Current protection readiness"
        />

        <Metric
          label="Provider"
          value={status?.provider ?? "—"}
          detail="Database infrastructure provider"
        />

        <Metric
          label="Recovery Mode"
          value={status?.recoveryMode ?? "—"}
          detail="Configured recovery capability"
        />

        <Metric
          label="Health Check"
          value={
            status
              ? `${status.responseTimeMs} ms`
              : "—"
          }
          detail="Latest database protection check"
        />
      </section>

      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Protection Status</h2>
              <p>
                Current backend backup and recovery configuration.
              </p>
            </div>

            <span
              className={`status-badge ${statusClass(
                status?.status,
              )}`}
            >
              {status?.status ?? "UNKNOWN"}
            </span>
          </div>

          <div className="health-list">
            <div className="health-row">
              <span>Database</span>
              <strong>{status?.database ?? "—"}</strong>
            </div>

            <div className="health-row">
              <span>Provider</span>
              <strong>{status?.provider ?? "—"}</strong>
            </div>

            <div className="health-row">
              <span>Backup strategy</span>
              <strong>{status?.backupStrategy ?? "—"}</strong>
            </div>

            <div className="health-row">
              <span>Recovery mode</span>
              <strong>{status?.recoveryMode ?? "—"}</strong>
            </div>

            <div className="health-row">
              <span>Physical backup</span>
              <strong>
                {status?.physicalBackupManagedExternally
                  ? "Managed externally"
                  : "Application managed"}
              </strong>
            </div>

            <div className="health-row">
              <span>Application snapshot</span>
              <strong>
                {status?.applicationSnapshotMode ?? "—"}
              </strong>
            </div>

            <div className="health-row">
              <span>Last checked</span>
              <strong>{formatDate(status?.checkedAt)}</strong>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Protected Records</h2>
              <p>
                Current records included in the protection status
                observation.
              </p>
            </div>
          </div>

          <div className="health-list">
            <div className="health-row">
              <span>Users</span>
              <strong>{records?.users ?? "—"}</strong>
            </div>

            <div className="health-row">
              <span>Bookings</span>
              <strong>{records?.bookings ?? "—"}</strong>
            </div>

            <div className="health-row">
              <span>Payments</span>
              <strong>{records?.payments ?? "—"}</strong>
            </div>

            <div className="health-row">
              <span>Vehicles</span>
              <strong>{records?.vehicles ?? "—"}</strong>
            </div>

            <div className="health-row">
              <span>Documents</span>
              <strong>{records?.documents ?? "—"}</strong>
            </div>

            <div className="health-row">
              <span>Audit logs</span>
              <strong>{records?.auditLogs ?? "—"}</strong>
            </div>
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Administrative Snapshot</h2>
            <p>
              Request an auditable application-level snapshot
              record. This does not replace Supabase physical
              backups.
            </p>
          </div>

          <button
            type="button"
            className="primary-button"
            onClick={() => void handleSnapshotRequest()}
            disabled={requesting}
          >
            {requesting
              ? "Requesting…"
              : "Request Snapshot"}
          </button>
        </div>

        {snapshot && (
          <div className="health-list">
            <div className="health-row">
              <span>Snapshot ID</span>
              <strong>{snapshot.id}</strong>
            </div>

            <div className="health-row">
              <span>Type</span>
              <strong>{snapshot.type}</strong>
            </div>

            <div className="health-row">
              <span>Status</span>
              <strong>{snapshot.status}</strong>
            </div>

            <div className="health-row">
              <span>Requested at</span>
              <strong>
                {formatDate(snapshot.requestedAt)}
              </strong>
            </div>

            <div className="health-row">
              <span>Audit log ID</span>
              <strong>{snapshot.auditLogId}</strong>
            </div>
          </div>
        )}
      </section>
    </section>
  );
}
