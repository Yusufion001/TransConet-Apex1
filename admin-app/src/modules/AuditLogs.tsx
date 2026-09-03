import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getSecurityAuditLogs,
  type SecurityAuditLog,
} from "../api/security";
import { subscribeAdminRealtime } from "../realtime/admin-realtime";

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function actorName(log: SecurityAuditLog) {
  if (!log.administrator) return "System";

  return (
    `${log.administrator.firstName ?? ""} ${log.administrator.lastName ?? ""}`.trim() ||
    log.administrator.email ||
    "Administrator"
  );
}

function affectedUserName(log: SecurityAuditLog) {
  if (!log.affectedUser) return log.affectedUserId ?? "—";

  return (
    `${log.affectedUser.firstName ?? ""} ${log.affectedUser.lastName ?? ""}`.trim() ||
    log.affectedUser.email ||
    log.affectedUser.id
  );
}

function actionClass(action: string) {
  const value = action.toUpperCase();

  if (
    value.includes("DELETE") ||
    value.includes("DISABLE") ||
    value.includes("SUSPEND") ||
    value.includes("REJECT") ||
    value.includes("FAIL")
  ) {
    return "status-warning";
  }

  if (
    value.includes("CREATE") ||
    value.includes("UPDATE") ||
    value.includes("ENABLE") ||
    value.includes("APPROVE") ||
    value.includes("UNLOCK")
  ) {
    return "status-active";
  }

  return "status-neutral";
}

function AuditLogs() {
  const [logs, setLogs] = useState<SecurityAuditLog[]>([]);
  const [selected, setSelected] = useState<SecurityAuditLog | null>(null);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");

  const loadLogs = useCallback(async (initial = false) => {
    try {
      if (initial) setLoading(true);
      else setRefreshing(true);

      setError("");

      const data = await getSecurityAuditLogs({
        action: actionFilter || undefined,
        limit: 200,
      });

      setLogs(data);

      setSelected((current) => {
        if (!current) return null;
        return data.find((log) => log.id === current.id) ?? null;
      });
    } catch {
      setError(
        "Unable to load Audit Logs. Verify that your administrator account has SECURITY_CENTER permission.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [actionFilter]);

  useEffect(() => {
    void loadLogs(true);
  }, [loadLogs]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    void subscribeAdminRealtime("SECURITY_CENTER", {
      onActivity: () => {
        if (!cancelled) {
          void loadLogs(false);
        }
      },
      onModuleEvent: () => {
        if (!cancelled) {
          void loadLogs(false);
        }
      },
      onConnectionChange: (value) => {
        if (!cancelled) setConnected(value);
      },
      onAccessDenied: (message) => {
        if (!cancelled) setError(message);
      },
    })
      .then((cleanup) => {
        if (cancelled) cleanup();
        else unsubscribe = cleanup;
      })
      .catch((err) => {
        if (!cancelled) {
          setConnected(false);
          setError(
            err instanceof Error
              ? err.message
              : "Realtime Audit Logs connection unavailable.",
          );
        }
      });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [loadLogs]);

  const actions = useMemo(
    () => Array.from(new Set(logs.map((log) => log.action))).sort(),
    [logs],
  );

  const filteredLogs = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return logs;

    return logs.filter((log) =>
      [
        log.action,
        log.administratorId,
        actorName(log),
        log.affectedUserId ?? "",
        affectedUserName(log),
        log.affectedBookingId ?? "",
        log.ipAddress ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [logs, search]);

  return (
    <section className="module-workspace">
      <div className="module-header">
        <div>
          <span className="module-kicker">
            TRANSCONET-APEX1 ADMINISTRATION
          </span>
          <h2>Audit Logs</h2>
          <p>
            Review persistent administrative activity recorded by the
            platform.
          </p>
        </div>

        <div className="module-controls">
          <span className={`status-badge ${connected ? "status-active" : "status-warning"}`}>
            {connected ? "LIVE" : "OFFLINE"}
          </span>

          <button
            type="button"
            className="text-button"
            onClick={() => void loadLogs(false)}
            disabled={refreshing}
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {error && (
        <div className="module-card module-error">
          <strong>Audit Logs unavailable</strong>
          <p>{error}</p>
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card">
          <span>Records</span>
          <strong>{loading ? "…" : logs.length}</strong>
          <small>Persistent audit records loaded</small>
        </div>

        <div className="stat-card">
          <span>Visible</span>
          <strong>{loading ? "…" : filteredLogs.length}</strong>
          <small>Records matching the current search</small>
        </div>

        <div className="stat-card">
          <span>Actions</span>
          <strong>{loading ? "…" : actions.length}</strong>
          <small>Action types represented</small>
        </div>

        <div className="stat-card">
          <span>Realtime</span>
          <strong>{connected ? "Connected" : "Disconnected"}</strong>
          <small>Administrative event channel</small>
        </div>
      </div>

      <section className="module-card">
        <div className="module-toolbar">
          <div>
            <strong>Administrative activity history</strong>
            <span>
              Records are retrieved from the backend AuditLog store. Realtime
              events trigger a fresh database-backed read.
            </span>
          </div>

          <div className="module-controls">
            <label>
              <span>Search</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search administrator, user, booking or action"
              />
            </label>

            <label>
              <span>Action</span>
              <select
                value={actionFilter}
                onChange={(event) => setActionFilter(event.target.value)}
              >
                <option value="">All actions</option>
                {actions.map((action) => (
                  <option key={action} value={action}>
                    {action}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {loading ? (
          <div className="customer-state">
            <strong>Loading audit records…</strong>
            <span>Retrieving persistent administrative activity.</span>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="customer-state">
            <strong>No audit records found</strong>
            <span>No records match the current filters.</span>
          </div>
        ) : (
          <div className="health-list">
            {filteredLogs.map((log) => (
              <button
                key={log.id}
                type="button"
                className="health-row"
                onClick={() => setSelected(log)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  cursor: "pointer",
                  background: "transparent",
                  border: 0,
                }}
              >
                <span>
                  <strong>{log.action}</strong>
                  <br />
                  <small>
                    {actorName(log)} · {formatDate(log.createdAt)}
                  </small>
                </span>

                <span
                  className={`status-badge ${actionClass(log.action)}`}
                >
                  {log.affectedBookingId
                    ? "BOOKING"
                    : log.affectedUserId
                      ? "USER"
                      : "ADMIN"}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      {selected && (
        <section className="module-card">
          <div className="module-toolbar">
            <div>
              <strong>Audit record details</strong>
              <span>Persistent record from the backend AuditLog store.</span>
            </div>

            <button
              type="button"
              className="text-button"
              onClick={() => setSelected(null)}
            >
              Close
            </button>
          </div>

          <div className="health-list">
            <div className="health-row">
              <span>Audit ID</span>
              <strong>{selected.id}</strong>
            </div>

            <div className="health-row">
              <span>Action</span>
              <strong>{selected.action}</strong>
            </div>

            <div className="health-row">
              <span>Administrator</span>
              <strong>{actorName(selected)}</strong>
            </div>

            <div className="health-row">
              <span>Administrator ID</span>
              <strong>{selected.administratorId}</strong>
            </div>

            <div className="health-row">
              <span>Affected user</span>
              <strong>{affectedUserName(selected)}</strong>
            </div>

            <div className="health-row">
              <span>Affected booking</span>
              <strong>{selected.affectedBookingId ?? "—"}</strong>
            </div>

            <div className="health-row">
              <span>IP address</span>
              <strong>{selected.ipAddress ?? "—"}</strong>
            </div>

            <div className="health-row">
              <span>Created</span>
              <strong>{formatDate(selected.createdAt)}</strong>
            </div>
          </div>

          <div className="module-card">
            <strong>Previous value</strong>
            <pre
              style={{
                overflowX: "auto",
                whiteSpace: "pre-wrap",
                marginTop: "12px",
              }}
            >
              {JSON.stringify(selected.previousValue ?? {}, null, 2)}
            </pre>
          </div>

          <div className="module-card">
            <strong>New value</strong>
            <pre
              style={{
                overflowX: "auto",
                whiteSpace: "pre-wrap",
                marginTop: "12px",
              }}
            >
              {JSON.stringify(selected.newValue ?? {}, null, 2)}
            </pre>
          </div>

          <div className="module-card">
            <strong>Device metadata</strong>
            <pre
              style={{
                overflowX: "auto",
                whiteSpace: "pre-wrap",
                marginTop: "12px",
              }}
            >
              {JSON.stringify(selected.deviceMetadata ?? {}, null, 2)}
            </pre>
          </div>
        </section>
      )}
    </section>
  );
}

export default AuditLogs;
