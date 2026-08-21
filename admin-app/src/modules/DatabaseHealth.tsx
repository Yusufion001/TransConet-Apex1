import { useCallback, useEffect, useState } from "react";
import {
  getDatabaseHealth,
  type DatabaseHealth as DatabaseHealthData,
} from "../api/database-health";

function statusClass(value: string) {
  return value.toUpperCase() === "HEALTHY" ||
    value.toUpperCase() === "CONNECTED"
    ? "status-active"
    : "status-warning";
}

function formatDate(value?: string) {
  if (!value) return "—";

  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString();
}

export default function DatabaseHealth() {
  const [health, setHealth] =
    useState<DatabaseHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadHealth = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);

      setError("");
      setHealth(await getDatabaseHealth());
    } catch {
      setError(
        "Unable to load Database Health. Verify that your administrator account has DATABASE_HEALTH permission.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadHealth();
  }, [loadHealth]);

  if (loading) {
    return (
      <section className="module-workspace">
        <div className="module-header">
          <div>
            <span className="module-kicker">
              TRANSCONET-APEX1 SYSTEM
            </span>
            <h2>Database Health</h2>
            <p>
              Monitor the health and connectivity of the platform
              PostgreSQL database.
            </p>
          </div>
        </div>

        <div className="panel customer-state">
          <strong>Loading Database Health…</strong>
          <span>
            Running the backend database health check.
          </span>
        </div>
      </section>
    );
  }

  return (
    <section className="module-workspace">
      <div className="module-header">
        <div>
          <span className="module-kicker">
            TRANSCONET-APEX1 SYSTEM
          </span>
          <h2>Database Health</h2>
          <p>
            Monitor PostgreSQL connectivity, query response
            performance, and live platform record counts.
          </p>
        </div>

        <button
          type="button"
          className="text-button"
          onClick={() => void loadHealth(true)}
          disabled={refreshing}
        >
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="panel customer-state error-state">
          <strong>Database Health unavailable</strong>
          <span>{error}</span>
        </div>
      )}

      <section className="stats-grid">
        <div className="stat-card">
          <span>Database Status</span>
          <strong>{health?.status ?? "—"}</strong>
          <small>Latest health observation</small>
        </div>

        <div className="stat-card">
          <span>Engine</span>
          <strong>{health?.database ?? "—"}</strong>
          <small>Configured database engine</small>
        </div>

        <div className="stat-card">
          <span>Connection</span>
          <strong>{health?.connection ?? "—"}</strong>
          <small>Current connectivity state</small>
        </div>

        <div className="stat-card">
          <span>Response Time</span>
          <strong>
            {health
              ? `${health.responseTimeMs} ms`
              : "—"}
          </strong>
          <small>Latest SELECT health check</small>
        </div>
      </section>

      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Database Status</h2>
              <p>
                Current state returned directly by the backend.
              </p>
            </div>

            <span
              className={`status-badge ${
                health
                  ? statusClass(health.status)
                  : "status-warning"
              }`}
            >
              {health?.status ?? "UNKNOWN"}
            </span>
          </div>

          <div className="health-list">
            <div className="health-row">
              <span>Database</span>
              <strong>{health?.database ?? "—"}</strong>
            </div>

            <div className="health-row">
              <span>Connection</span>
              <strong>{health?.connection ?? "—"}</strong>
            </div>

            <div className="health-row">
              <span>Response time</span>
              <strong>
                {health
                  ? `${health.responseTimeMs} ms`
                  : "—"}
              </strong>
            </div>

            <div className="health-row">
              <span>Last checked</span>
              <strong>
                {formatDate(health?.checkedAt)}
              </strong>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Platform Records</h2>
              <p>
                Live counts returned by the database health service.
              </p>
            </div>
          </div>

          <div className="health-list">
            <div className="health-row">
              <span>Users</span>
              <strong>{health?.records.users ?? "—"}</strong>
            </div>

            <div className="health-row">
              <span>Bookings</span>
              <strong>{health?.records.bookings ?? "—"}</strong>
            </div>

            <div className="health-row">
              <span>Payments</span>
              <strong>{health?.records.payments ?? "—"}</strong>
            </div>

            <div className="health-row">
              <span>Vehicles</span>
              <strong>{health?.records.vehicles ?? "—"}</strong>
            </div>

            <div className="health-row">
              <span>Documents</span>
              <strong>{health?.records.documents ?? "—"}</strong>
            </div>

            <div className="health-row">
              <span>Notifications</span>
              <strong>
                {health?.records.notifications ?? "—"}
              </strong>
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}
