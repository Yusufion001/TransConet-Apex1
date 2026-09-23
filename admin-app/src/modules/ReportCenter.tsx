import { useEffect, useState } from "react";
import {
  generateReport,
  getReportsOverview,
  type GeneratedReport,
  type ReportsOverview,
} from "../api/reports";

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function Metric({
  label,
  value,
  description,
}: {
  label: string;
  value: number | string;
  description: string;
}) {
  return (
    <div className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{description}</small>
    </div>
  );
}

function ReportCenter() {
  const [overview, setOverview] = useState<ReportsOverview | null>(null);
  const [generatedReport, setGeneratedReport] =
    useState<GeneratedReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  async function loadReports() {
    try {
      setLoading(true);
      setError("");

      const data = await getReportsOverview();
      setOverview(data);
    } catch {
      setError("Unable to load the Report Center.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate() {
    try {
      setGenerating(true);
      setError("");

      const report = await generateReport();
      setGeneratedReport(report);
    } catch {
      setError("Unable to generate the report snapshot.");
    } finally {
      setGenerating(false);
    }
  }

  useEffect(() => {
    void loadReports();
  }, []);

  return (
    <section className="module-workspace report-center-workspace">
      <div className="module-header report-center-module-header">
        <span className="module-kicker">TRANSCONET-APEX1 GOVERNANCE</span>
        <h2>Report Center</h2>
        <p>
          Live operational reporting across platform activity, operations,
          financial activity, compliance, and communication.
        </p>
      </div>

      {error && (
        <div className="module-card module-error report-center-error-state">
          <strong>Report Center operation failed</strong>
          <p>{error}</p>
        </div>
      )}

      <div className="module-card report-center-command-panel">
        <div className="module-toolbar report-center-command-toolbar">
          <div>
            <strong>Reporting controls</strong>
            <span>
              Metrics are calculated from current platform records.
            </span>
          </div>

          <div className="module-controls">
            <button
              type="button"
              className="refresh-button"
              disabled={loading}
              onClick={() => void loadReports()}
            >
              {loading ? "Refreshing…" : "Refresh Reports"}
            </button>

            <button
              type="button"
              disabled={generating}
              onClick={() => void handleGenerate()}
            >
              {generating ? "Generating…" : "Generate Report Snapshot"}
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="module-card">
          <div className="module-empty">
            <strong>Loading reports…</strong>
            <span>Retrieving current platform reporting data.</span>
          </div>
        </div>
      ) : !overview ? (
        <div className="module-card">
          <div className="module-empty">
            <strong>No reporting data available</strong>
          </div>
        </div>
      ) : (
        <>
          <div className="module-card report-center-section report-center-platform-section">
            <div className="panel-header report-center-section-header">
              <div>
                <p>Current platform population and infrastructure.</p>
              </div>
            </div>

            <div className="stats-grid report-center-kpi-grid">
              <Metric
                label="Users"
                value={overview.platform.users}
                description="All registered users"
              />
              <Metric
                label="Customers"
                value={overview.platform.customers}
                description="Customer accounts"
              />
              <Metric
                label="Transporters"
                value={overview.platform.transporters}
                description="Transporter accounts"
              />
              <Metric
                label="Administrators"
                value={overview.platform.administrators}
                description="Administrative accounts"
              />
              <Metric
                label="Vehicles"
                value={overview.platform.vehicles}
                description="Registered vehicles"
              />
            </div>
          </div>

          <div className="module-card report-center-section report-center-operations-section">
            <div className="panel-header report-center-section-header">
              <div>
                <p>Booking activity and operational completion.</p>
              </div>
            </div>

            <div className="stats-grid">
              <Metric
                label="Bookings"
                value={overview.operations.bookings}
                description="All bookings"
              />
              <Metric
                label="Completed"
                value={overview.operations.completedBookings}
                description="Completed bookings"
              />
              <Metric
                label="Cancelled"
                value={overview.operations.cancelledBookings}
                description="Cancelled bookings"
              />
              <Metric
                label="Completion Rate"
                value={`${overview.operations.completionRate}%`}
                description="Completed bookings / total bookings"
              />
            </div>
          </div>

          <div className="module-card report-center-section report-center-financial-section">
            <div className="panel-header report-center-section-header">
              <div>
                <p>Current payment and withdrawal activity.</p>
              </div>
            </div>

            <div className="stats-grid">
              <Metric
                label="Payments"
                value={overview.financial.payments}
                description="All payment records"
              />
              <Metric
                label="Successful"
                value={overview.financial.successfulPayments}
                description="Successful payments"
              />
              <Metric
                label="Failed"
                value={overview.financial.failedPayments}
                description="Failed payments"
              />
              <Metric
                label="Withdrawals"
                value={overview.financial.withdrawals}
                description="Withdrawal records"
              />
            </div>
          </div>

          <div className="module-card report-center-section report-center-compliance-section">
            <div className="panel-header report-center-section-header">
              <div>
                <p>
                  Documents and operational cases requiring administrative
                  visibility.
                </p>
              </div>
            </div>

            <div className="stats-grid">
              <Metric
                label="Documents"
                value={overview.compliance.documents}
                description="Stored platform documents"
              />
              <Metric
                label="Support Tickets"
                value={overview.compliance.supportTickets}
                description="Support cases"
              />
              <Metric
                label="Disputes"
                value={overview.compliance.disputes}
                description="Dispute records"
              />
            </div>
          </div>

          <div className="module-card report-center-section report-center-communication-section">
            <div className="panel-header report-center-section-header">
              <div>
                <p>Platform communication activity.</p>
              </div>
            </div>

            <div className="stats-grid">
              <Metric
                label="Messages"
                value={overview.communication.messages}
                description="Stored platform messages"
              />
            </div>
          </div>

          <div className="module-card report-center-snapshot-panel">
            <div className="panel-header report-center-snapshot-header">
              <div>
                <p>
                  Generate a controlled reporting event through the
                  administration backend.
                </p>
              </div>

              <span className="live-badge">
                <span className="status-dot" />
                ADMIN
              </span>
            </div>

            {generatedReport ? (
              <div className="detail-grid report-center-snapshot-grid">
                <div>
                  <span>Status</span>
                  <strong>{generatedReport.status}</strong>
                </div>

                <div>
                  <span>Report ID</span>
                  <strong>{generatedReport.id}</strong>
                </div>

                <div>
                  <span>Generated</span>
                  <strong>{formatDate(generatedReport.generatedAt)}</strong>
                </div>
              </div>
            ) : (
              <div className="module-empty">
                <strong>No report snapshot generated this session.</strong>
                <span>
                  Use Generate Report Snapshot to publish a report-generation
                  event.
                </span>
              </div>
            )}
          </div>

          <div className="report-generated-meta report-center-generated-meta">
            <span>
              Live metrics generated at{" "}
              <strong>{formatDate(overview.generatedAt)}</strong>
            </span>
          </div>
        </>
      )}
    </section>
  );
}

export default ReportCenter;
