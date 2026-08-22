import { useCallback, useEffect, useState } from "react";
import {
  getAIAutomationOverview,
  runAIAutomation,
  type AIAutomationOverview,
  type AutomationRun,
} from "../api/ai-automation";

function formatDate(value?: string) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString();
}

function priorityClass(priority: string) {
  const value = priority.toUpperCase();

  if (value === "HIGH" || value === "CRITICAL") {
    return "status-warning";
  }

  if (value === "LOW") {
    return "status-active";
  }

  return "status-warning";
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

export default function AIAutomation() {
  const [overview, setOverview] =
    useState<AIAutomationOverview | null>(null);
  const [lastRun, setLastRun] = useState<AutomationRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadData = useCallback(async (refresh = false) => {
    try {
      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");
      setNotice("");

      setOverview(await getAIAutomationOverview());
    } catch {
      setError(
        "Unable to load AI Automation data. Verify that your administrator account has AI_AUTOMATION permission.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleRun() {
    try {
      setRunning(true);
      setError("");
      setNotice("");

      const result = await runAIAutomation();

      setLastRun(result);
      setNotice(
        `Automation run ${result.status.toLowerCase()} successfully.`,
      );

      await loadData(true);
    } catch {
      setError(
        "Unable to run automation. Verify that your administrator account has AI_AUTOMATION permission.",
      );
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return (
      <section className="module-workspace">
        <div className="module-header">
          <div>
            <span className="module-kicker">
              TRANSCONET-APEX1 SYSTEM INTELLIGENCE
            </span>
            <h2>AI Automation</h2>
            <p>
              Rule-based operational intelligence and administrative
              recommendations.
            </p>
          </div>
        </div>

        <div className="panel customer-state">
          <strong>Loading AI Automation…</strong>
          <span>
            Evaluating current platform operational signals.
          </span>
        </div>
      </section>
    );
  }

  const metrics = overview?.metrics;

  return (
    <section className="module-workspace">
      <div className="module-header">
        <div>
          <span className="module-kicker">
            TRANSCONET-APEX1 SYSTEM INTELLIGENCE
          </span>

          <h2>AI Automation</h2>

          <p>
            Monitor operational signals and receive rule-based
            recommendations across the TransConet platform.
          </p>
        </div>

        <div className="module-actions">
          <button
            type="button"
            className="text-button"
            onClick={() => void loadData(true)}
            disabled={refreshing || running}
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>

          <button
            type="button"
            className="primary-button"
            onClick={() => void handleRun()}
            disabled={running}
          >
            {running ? "Running…" : "Run Automation"}
          </button>
        </div>
      </div>

      {error && (
        <div className="panel customer-state error-state">
          <strong>AI Automation unavailable</strong>
          <span>{error}</span>
        </div>
      )}

      {notice && (
        <div className="panel customer-state">
          <strong>Automation complete</strong>
          <span>{notice}</span>
        </div>
      )}

      <section className="stats-grid">
        <Metric
          label="Automation Status"
          value={overview?.status ?? "—"}
          detail={
            overview?.automation.enabled
              ? "Automation enabled"
              : "Automation disabled"
          }
        />

        <Metric
          label="Operating Mode"
          value={overview?.automation.mode ?? "—"}
          detail="Current automation engine"
        />

        <Metric
          label="Active Bookings"
          value={metrics?.activeBookings ?? "—"}
          detail="Bookings currently in operational flow"
        />

        <Metric
          label="Pending Verification"
          value={metrics?.pendingDocuments ?? "—"}
          detail="Documents awaiting review"
        />

        <Metric
          label="Support Backlog"
          value={metrics?.openSupportTickets ?? "—"}
          detail="Open and in-progress tickets"
        />

        <Metric
          label="Open Disputes"
          value={metrics?.openDisputes ?? "—"}
          detail="Active disputes requiring attention"
        />

        <Metric
          label="Failed Payments"
          value={metrics?.failedPayments ?? "—"}
          detail="Payments currently recorded as failed"
        />

        <Metric
          label="Platform Users"
          value={metrics?.users ?? "—"}
          detail="Total registered users"
        />
      </section>

      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Automation State</h2>
              <p>
                Current configuration returned directly by the backend.
              </p>
            </div>

            <span
              className={`status-badge ${
                overview?.automation.enabled
                  ? "status-active"
                  : "status-warning"
              }`}
            >
              {overview?.automation.enabled ? "ENABLED" : "DISABLED"}
            </span>
          </div>

          <div className="health-list">
            <div className="health-row">
              <span>Engine</span>
              <strong>{overview?.automation.mode ?? "—"}</strong>
            </div>

            <div className="health-row">
              <span>Status</span>
              <strong>{overview?.status ?? "—"}</strong>
            </div>

            <div className="health-row">
              <span>Generated at</span>
              <strong>{formatDate(overview?.generatedAt)}</strong>
            </div>

            {lastRun && (
              <>
                <div className="health-row">
                  <span>Last run ID</span>
                  <strong>{lastRun.id}</strong>
                </div>

                <div className="health-row">
                  <span>Last run status</span>
                  <strong>{lastRun.status}</strong>
                </div>

                <div className="health-row">
                  <span>Last run completed</span>
                  <strong>{formatDate(lastRun.completedAt)}</strong>
                </div>
              </>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Operational Recommendations</h2>
              <p>
                Rule-based recommendations generated from current
                platform conditions.
              </p>
            </div>
          </div>

          {overview?.recommendations.length ? (
            <div className="health-list">
              {overview.recommendations.map((recommendation) => (
                <div
                  className="health-row"
                  key={`${recommendation.type}-${recommendation.action}`}
                >
                  <div>
                    <strong>{recommendation.action}</strong>
                    <small>
                      {recommendation.type} · {recommendation.count} affected
                    </small>
                  </div>

                  <span
                    className={`status-badge ${priorityClass(
                      recommendation.priority,
                    )}`}
                  >
                    {recommendation.priority}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="customer-state">
              <strong>No current recommendations</strong>
              <span>
                The automation engine has not identified an active
                operational backlog.
              </span>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
