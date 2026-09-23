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
    <section className="module-workspace audit-logs-workspace">
      <div className="module-header audit-logs-module-header">
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

        <div className="module-controls audit-logs-header-actions">
          <span className={`status-badge audit-realtime-badge ${connected ? "status-active" : "status-warning"}`}>
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

      <div className="stats-grid audit-logs-kpi-grid">
        <div className="stat-card audit-kpi-card">
          <span>Records</span>
          <strong>{loading ? "…" : logs.length}</strong>
          <small>Persistent audit records loaded</small>
        </div>

        <div className="stat-card audit-kpi-card">
          <span>Visible</span>
          <strong>{loading ? "…" : filteredLogs.length}</strong>
          <small>Records matching the current search</small>
        </div>

        <div className="stat-card audit-kpi-card">
          <span>Actions</span>
          <strong>{loading ? "…" : actions.length}</strong>
          <small>Action types represented</small>
        </div>

        <div className="stat-card audit-kpi-card audit-realtime-kpi">
          <span>Realtime</span>
          <strong>{connected ? "Connected" : "Disconnected"}</strong>
          <small>Administrative event channel</small>
        </div>
      </div>

      <section className="module-card audit-command-panel">
        <div className="module-toolbar audit-command-header">
          <div>
            <strong>Administrative activity history</strong>
            <span>
              Records are retrieved from the backend AuditLog store. Realtime
              events trigger a fresh database-backed read.
            </span>
          </div>

          <div className="module-controls audit-filter-controls">
            <label className="audit-search-control">
              <span>Search</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search administrator, user, booking or action"
              />
            </label>

            <label className="audit-action-control">
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
          <div className="audit-log-table-wrap">
            <div className="audit-log-table-head">
              <span>Action</span>
              <span>Administrator</span>
              <span>Target</span>
              <span>Timestamp</span>
            </div>

            <div className="audit-log-list">
            {filteredLogs.map((log) => (
              <button
                key={log.id}
                type="button"
                className="audit-log-row"
                onClick={() => setSelected(log)}
              >
                <span className="audit-log-action">
                  <strong>{log.action}</strong>
                  <small>{log.id}</small>
                </span>

                <span className="audit-log-actor">
                  <strong>{actorName(log)}</strong>
                  <small>{log.administratorId}</small>
                </span>

                <span className="audit-log-target">
                  <span className={`status-badge ${actionClass(log.action)}`}>
                    {log.affectedBookingId
                      ? "BOOKING"
                      : log.affectedUserId
                        ? "USER"
                        : "ADMIN"}
                  </span>
                  <small>
                    {log.affectedBookingId ??
                      log.affectedUserId ??
                      "Administrator action"}
                  </small>
                </span>

                <span className="audit-log-time">
                  <strong>{formatDate(log.createdAt)}</strong>
                  <small>{log.ipAddress ?? "IP unavailable"}</small>
                </span>
              </button>
            ))}
            </div>
          </div>
        )}
      </section>

      {selected && (
        <section className="module-card audit-detail-panel">
          <div className="module-toolbar audit-detail-header">
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

          <div className="audit-detail-grid">
            <div className="audit-detail-field">
              <span>Audit ID</span>
              <strong>{selected.id}</strong>
            </div>

            <div className="audit-detail-field">
              <span>Action</span>
              <strong>{selected.action}</strong>
            </div>

            <div className="audit-detail-field">
              <span>Administrator</span>
              <strong>{actorName(selected)}</strong>
            </div>

            <div className="audit-detail-field">
              <span>Administrator ID</span>
              <strong>{selected.administratorId}</strong>
            </div>

            <div className="audit-detail-field">
              <span>Affected user</span>
              <strong>{affectedUserName(selected)}</strong>
            </div>

            <div className="audit-detail-field">
              <span>Affected booking</span>
              <strong>{selected.affectedBookingId ?? "—"}</strong>
            </div>

            <div className="audit-detail-field">
              <span>IP address</span>
              <strong>{selected.ipAddress ?? "—"}</strong>
            </div>

            <div className="audit-detail-field">
              <span>Created</span>
              <strong>{formatDate(selected.createdAt)}</strong>
            </div>
          </div>

          <div className="audit-json-panel">
            <div className="audit-json-heading">
              <strong>Previous value</strong>
              <span>Recorded state before the administrative action</span>
            </div>
            <pre>
              {JSON.stringify(selected.previousValue ?? {}, null, 2)}
            </pre>
          </div>

          <div className="audit-json-panel">
            <div className="audit-json-heading">
              <strong>New value</strong>
              <span>Recorded state after the administrative action</span>
            </div>
            <pre>
              {JSON.stringify(selected.newValue ?? {}, null, 2)}
            </pre>
          </div>

          <div className="audit-json-panel">
            <div className="audit-json-heading">
              <strong>Device metadata</strong>
              <span>Security context captured with the audit record</span>
            </div>
            <pre>
              {JSON.stringify(selected.deviceMetadata ?? {}, null, 2)}
            </pre>
          </div>
        </section>
      )}
    </section>
  );
}

export default AuditLogs;
