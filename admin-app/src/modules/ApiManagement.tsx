import { useCallback, useEffect, useState } from "react";
import {
  getApiHealth,
  getApiManagementOverview,
  type ApiHealth,
  type ApiManagementOverview,
} from "../api/api-management";

function statusClass(value: string) {
  return value.toUpperCase() === "OPERATIONAL" ||
    value.toUpperCase() === "HEALTHY"
    ? "status-active"
    : "status-warning";
}

function formatDate(value?: string) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString();
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

export default function ApiManagement() {
  const [overview, setOverview] =
    useState<ApiManagementOverview | null>(null);

  const [health, setHealth] =
    useState<ApiHealth | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadData = useCallback(async (refresh = false) => {
    try {
      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const [overviewData, healthData] = await Promise.all([
        getApiManagementOverview(),
        getApiHealth(),
      ]);

      setOverview(overviewData);
      setHealth(healthData);
    } catch {
      setError(
        "Unable to load API Management data. Verify that your administrator account has API_MANAGEMENT permission.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (loading) {
    return (
      <section className="module-workspace">
        <div className="module-header">
          <div>
            <span className="module-kicker">
              TRANSCONET-APEX1 SYSTEM
            </span>
            <h2>API Management</h2>
            <p>
              Monitor the health and resource activity of the
              TransConet-Apex1 API.
            </p>
          </div>
        </div>

        <div className="panel customer-state">
          <strong>Loading API Management…</strong>
          <span>
            Retrieving API overview and health information.
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

          <h2>API Management</h2>

          <p>
            Monitor API availability, database connectivity,
            response performance, and backend resource activity.
          </p>
        </div>

        <button
          type="button"
          className="text-button"
          onClick={() => void loadData(true)}
          disabled={refreshing}
        >
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="panel customer-state error-state">
          <strong>API Management unavailable</strong>
          <span>{error}</span>
        </div>
      )}

      <section className="stats-grid">
        <Metric
          label="API Status"
          value={overview?.status ?? "—"}
          detail={`Version ${overview?.apiVersion ?? "—"}`}
        />

        <Metric
          label="Database"
          value={health?.database ?? "—"}
          detail="API health database check"
        />

        <Metric
          label="Response Time"
          value={
            health
              ? `${health.responseTimeMs} ms`
              : "—"
          }
          detail="Latest database health check"
        />

        <Metric
          label="API Version"
          value={overview?.apiVersion ?? "—"}
          detail="Active backend API version"
        />
      </section>

      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>API Health</h2>
              <p>
                Latest infrastructure health observation.
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
              <span>API health status</span>
              <strong>{health?.status ?? "—"}</strong>
            </div>

            <div className="health-row">
              <span>Database connection</span>
              <strong>{health?.database ?? "—"}</strong>
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
              <h2>API Resources</h2>
              <p>
                Resource counts exposed by the backend
                management overview.
              </p>
            </div>
          </div>

          <div className="health-list">
            <div className="health-row">
              <span>Users</span>
              <strong>
                {overview?.resources.users ?? "—"}
              </strong>
            </div>

            <div className="health-row">
              <span>Bookings</span>
              <strong>
                {overview?.resources.bookings ?? "—"}
              </strong>
            </div>

            <div className="health-row">
              <span>Payments</span>
              <strong>
                {overview?.resources.payments ?? "—"}
              </strong>
            </div>

            <div className="health-row">
              <span>Notifications</span>
              <strong>
                {overview?.resources.notifications ?? "—"}
              </strong>
            </div>
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Management Scope</h2>
            <p>
              Current API Management capabilities exposed by
              the backend.
            </p>
          </div>
        </div>

        <div className="detail-grid">
          <div>
            <span>API version</span>
            <strong>{overview?.apiVersion ?? "—"}</strong>
          </div>

          <div>
            <span>Overview generated</span>
            <strong>
              {formatDate(overview?.generatedAt)}
            </strong>
          </div>

          <div>
            <span>Health checked</span>
            <strong>
              {formatDate(health?.checkedAt)}
            </strong>
          </div>

          <div>
            <span>Access requirement</span>
            <strong>API_MANAGEMENT</strong>
          </div>
        </div>
      </section>
    </section>
  );
}
