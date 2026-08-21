import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  createRiskAlert,
  getRiskFraudOverview,
  type RiskAlert,
  type RiskFraudOverview,
  type RiskIndicator,
} from "../api/riskFraud";

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function severityClass(severity: string) {
  return `risk-severity risk-${severity.toLowerCase()}`;
}

function indicatorLabel(code: string) {
  return code
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function RiskFraud() {
  const [overview, setOverview] = useState<RiskFraudOverview | null>(null);
  const [alerts, setAlerts] = useState<RiskAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [alertCode, setAlertCode] = useState("");
  const [alertSeverity, setAlertSeverity] = useState("HIGH");
  const [alertDescription, setAlertDescription] = useState("");

  async function loadOverview() {
    try {
      setLoading(true);
      setError("");

      const data = await getRiskFraudOverview();
      setOverview(data);
    } catch {
      setError("Unable to load Risk & Fraud monitoring data.");
    } finally {
      setLoading(false);
    }
  }

  async function submitAlert(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!alertCode.trim() || !alertDescription.trim()) {
      setError("Alert code and description are required.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      const alert = await createRiskAlert({
        code: alertCode.trim(),
        severity: alertSeverity,
        description: alertDescription.trim(),
      });

      setAlerts((current) => [alert, ...current]);
      setAlertCode("");
      setAlertDescription("");
    } catch {
      setError("Unable to publish the risk alert.");
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    void loadOverview();
  }, []);

  const highRiskIndicators = useMemo(
    () =>
      overview?.indicators.filter(
        (indicator) => indicator.severity === "HIGH",
      ) ?? [],
    [overview],
  );

  const mediumRiskIndicators = useMemo(
    () =>
      overview?.indicators.filter(
        (indicator) => indicator.severity === "MEDIUM",
      ) ?? [],
    [overview],
  );

  const totalSignals = useMemo(
    () =>
      overview
        ? Object.values(overview.summary).reduce(
            (total, value) => total + value,
            0,
          )
        : 0,
    [overview],
  );

  return (
    <section className="module-workspace">
      <div className="module-header">
        <span className="module-kicker">TRANSCONET-APEX1 GOVERNANCE</span>

        <h2>Risk &amp; Fraud</h2>

        <p>
          Monitor account, financial, dispute, and operational risk signals
          generated from live platform records and publish controlled
          administrative risk alerts.
        </p>
      </div>

      {error && (
        <div className="module-card module-error">
          <strong>Risk &amp; Fraud operation failed</strong>
          <p>{error}</p>
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card">
          <span>Risk Posture</span>
          <strong>{loading ? "…" : overview?.status ?? "UNKNOWN"}</strong>
          <small>Backend monitoring state</small>
        </div>

        <div className="stat-card">
          <span>High Risk Signals</span>
          <strong>{loading ? "…" : highRiskIndicators.length}</strong>
          <small>Indicators currently classified HIGH</small>
        </div>

        <div className="stat-card">
          <span>Medium Risk Signals</span>
          <strong>{loading ? "…" : mediumRiskIndicators.length}</strong>
          <small>Indicators currently classified MEDIUM</small>
        </div>

        <div className="stat-card">
          <span>Total Risk Signals</span>
          <strong>{loading ? "…" : totalSignals}</strong>
          <small>Underlying monitored records</small>
        </div>
      </div>

      <div className="module-card">
        <div className="module-toolbar">
          <div>
            <strong>Live risk indicators</strong>
            <span>
              Counts are retrieved directly from the Risk &amp; Fraud
              administration API.
            </span>
          </div>

          <button
            type="button"
            className="refresh-button"
            disabled={loading}
            onClick={() => void loadOverview()}
          >
            {loading ? "Refreshing…" : "Refresh Monitoring"}
          </button>
        </div>

        {loading ? (
          <div className="module-empty">
            <strong>Loading risk monitoring…</strong>
          </div>
        ) : !overview ? (
          <div className="module-empty">
            <strong>No monitoring data available</strong>
          </div>
        ) : (
          <>
            <div className="risk-indicator-grid">
              {overview.indicators.map((indicator: RiskIndicator) => (
                <article className="risk-indicator" key={indicator.code}>
                  <div>
                    <span>{indicatorLabel(indicator.code)}</span>
                    <strong>{indicator.count}</strong>
                  </div>

                  <span className={severityClass(indicator.severity)}>
                    {indicator.severity}
                  </span>
                </article>
              ))}
            </div>

            <div className="risk-monitoring-meta">
              <span>
                Last checked: <strong>{formatDate(overview.checkedAt)}</strong>
              </span>
            </div>
          </>
        )}
      </div>

      {overview && (
        <div className="module-card">
          <div className="panel-header">
            <div>
              <h2>Risk signal categories</h2>
              <p>Operational interpretation of backend monitoring signals.</p>
            </div>
          </div>

          <div className="risk-category-grid">
            <div>
              <strong>Account Risk</strong>
              <span>
                Blocked and suspended user accounts requiring administrative
                attention.
              </span>
              <b>
                {overview.summary.blockedUsers +
                  overview.summary.suspendedUsers}
              </b>
            </div>

            <div>
              <strong>Financial Risk</strong>
              <span>
                Failed payments and withdrawals, plus refunded transactions.
              </span>
              <b>
                {overview.summary.failedPayments +
                  overview.summary.failedWithdrawals +
                  overview.summary.refundedPayments}
              </b>
            </div>

            <div>
              <strong>Dispute Risk</strong>
              <span>
                Open and investigating disputes requiring operational review.
              </span>
              <b>
                {overview.summary.openDisputes +
                  overview.summary.investigatingDisputes}
              </b>
            </div>

            <div>
              <strong>Booking Risk</strong>
              <span>
                Cancelled bookings currently visible to the monitoring layer.
              </span>
              <b>{overview.summary.cancelledBookings}</b>
            </div>
          </div>
        </div>
      )}

      <div className="module-card">
        <div className="panel-header">
          <div>
            <h2>Publish Risk Alert</h2>
            <p>
              Send a controlled administrative risk alert through the backend
              realtime event channel.
            </p>
          </div>

          <span className="live-badge">
            <span className="status-dot" />
            REALTIME
          </span>
        </div>

        <form className="risk-alert-form" onSubmit={submitAlert}>
          <label>
            <span>Alert code</span>
            <input
              value={alertCode}
              onChange={(event) => setAlertCode(event.target.value)}
              placeholder="e.g. SUSPICIOUS_WITHDRAWAL"
              maxLength={100}
            />
          </label>

          <label>
            <span>Severity</span>
            <select
              value={alertSeverity}
              onChange={(event) => setAlertSeverity(event.target.value)}
            >
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
              <option value="CRITICAL">CRITICAL</option>
            </select>
          </label>

          <label className="risk-alert-description">
            <span>Description</span>
            <textarea
              value={alertDescription}
              onChange={(event) => setAlertDescription(event.target.value)}
              placeholder="Describe the risk condition requiring administrative attention."
              maxLength={5000}
              rows={5}
            />
          </label>

          <button type="submit" disabled={submitting}>
            {submitting ? "Publishing…" : "Publish Risk Alert"}
          </button>
        </form>
      </div>

      {alerts.length > 0 && (
        <div className="module-card">
          <div className="panel-header">
            <div>
              <h2>Alerts Published This Session</h2>
              <p>
                These are alerts returned by the current alert-publishing
                operation.
              </p>
            </div>
          </div>

          <div className="risk-alert-list">
            {alerts.map((alert) => (
              <article className="risk-alert-item" key={alert.id}>
                <div>
                  <strong>{alert.code}</strong>
                  <span>{alert.description}</span>
                </div>

                <div>
                  <span className={severityClass(alert.severity)}>
                    {alert.severity}
                  </span>
                  <small>{formatDate(alert.createdAt)}</small>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export default RiskFraud;
