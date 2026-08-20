import { useCallback, useEffect, useMemo, useState } from "react";
import {
  approveSettlement,
  getFinancialOverview,
  getFinancialPayments,
  getFinancialWithdrawals,
  getPaymentWebhooks,
  getSettlements,
  rejectSettlement,
  releaseSettlement,
  resubmitSettlement,
  retryPaymentWebhook,
  submitSettlement,
  updateWithdrawalStatus,
  type FinancialOverview,
  type FinancialPayment,
  type FinancialWithdrawal,
  type PaymentWebhookEvent,
  type Settlement,
  type SettlementStatus,
} from "../api/financial-operations";

type Tab =
  | "overview"
  | "payments"
  | "webhooks"
  | "settlements"
  | "withdrawals";

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString();
}

function formatAmount(
  value?: string | number | null,
  currency?: string | null,
) {
  if (value === null || value === undefined) return "—";

  const amount = Number(value);

  if (!Number.isFinite(amount)) return String(value);

  return `${currency ? `${currency} ` : ""}${amount.toLocaleString(
    undefined,
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
  )}`;
}

function statusClass(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function Stat({
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

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="customer-empty">
      <strong>{title}</strong>
      <span>{description}</span>
    </div>
  );
}

export default function FinancialOperations() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  const [overview, setOverview] =
    useState<FinancialOverview | null>(null);

  const [payments, setPayments] = useState<FinancialPayment[]>([]);
  const [webhooks, setWebhooks] = useState<PaymentWebhookEvent[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [withdrawals, setWithdrawals] =
    useState<FinancialWithdrawal[]>([]);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] =
    useState<string | null>(null);
  const [error, setError] = useState("");

  const [settlementFilter, setSettlementFilter] =
    useState<SettlementStatus | "">("");

  const loadFinancialData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [
        overviewData,
        paymentData,
        webhookData,
        settlementData,
        withdrawalData,
      ] = await Promise.all([
        getFinancialOverview(),
        getFinancialPayments(),
        getPaymentWebhooks(),
        getSettlements(
          settlementFilter
            ? { status: settlementFilter }
            : undefined,
        ),
        getFinancialWithdrawals(),
      ]);

      setOverview(overviewData);
      setPayments(paymentData);
      setWebhooks(webhookData);
      setSettlements(settlementData);
      setWithdrawals(withdrawalData);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load Financial Operations.",
      );
    } finally {
      setLoading(false);
    }
  }, [settlementFilter]);

  useEffect(() => {
    void loadFinancialData();
  }, [loadFinancialData]);

  const runAction = async (
    key: string,
    action: () => Promise<unknown>,
  ) => {
    try {
      setActionLoading(key);
      setError("");
      await action();
      await loadFinancialData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Financial operation failed.",
      );
    } finally {
      setActionLoading(null);
    }
  };

  const financialTotals = useMemo(
    () => ({
      grossPayments:
        overview?.payments.totalAmount ?? 0,
      successfulPayments:
        overview?.payments.successfulAmount ?? 0,
      withdrawals:
        overview?.withdrawals.totalAmount ?? 0,
    }),
    [overview],
  );

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "payments", label: "Payments" },
    { id: "webhooks", label: "Webhooks" },
    { id: "settlements", label: "Settlements" },
    { id: "withdrawals", label: "Withdrawals" },
  ];

  if (loading && !overview) {
    return (
      <section className="dashboard">
        <div className="panel customer-state">
          Loading Financial Operations…
        </div>
      </section>
    );
  }

  return (
    <section className="dashboard">
      <div className="module-header">
        <div>
          <div className="module-kicker">
            FINANCIAL / COMMAND WORKSPACE
          </div>

          <h2>Financial Operations</h2>

          <p>
            Govern payments, payment processing events, settlement
            decisions and transporter withdrawals from one
            authorized workspace.
          </p>
        </div>

        <div>
          <span className="live-badge">
            <span className="status-dot" />
            CONNECTED
          </span>
        </div>
      </div>

      {error && (
        <div className="panel error-state" role="alert">
          {error}
        </div>
      )}

      <div className="stats-grid">
        <Stat
          label="Payment Volume"
          value={formatAmount(financialTotals.grossPayments)}
          detail={`${overview?.payments.total ?? 0} payment records`}
        />

        <Stat
          label="Successful Volume"
          value={formatAmount(
            financialTotals.successfulPayments,
          )}
          detail={`${overview?.payments.successful ?? 0} successful`}
        />

        <Stat
          label="Pending Payments"
          value={overview?.payments.pending ?? 0}
          detail="Awaiting completion"
        />

        <Stat
          label="Failed Payments"
          value={overview?.payments.failed ?? 0}
          detail="Requires monitoring"
        />

        <Stat
          label="Settlement Queue"
          value={
            settlements.filter(
              (item) => item.status === "AWAITING_APPROVAL",
            ).length
          }
          detail="Awaiting administrator decision"
        />

        <Stat
          label="Withdrawal Queue"
          value={overview?.withdrawals.pending ?? 0}
          detail="Awaiting processing"
        />
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <h2>Financial Control Surface</h2>
            <p>
              Backend-connected financial lifecycle management.
            </p>
          </div>

          <button
            type="button"
            className="text-button"
            disabled={loading}
            onClick={() => void loadFinancialData()}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        <div className="module-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={
                activeTab === tab.id
                  ? "module-tab active"
                  : "module-tab"
              }
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "overview" && (
        <OverviewPanel
          overview={overview}
          payments={payments}
          webhooks={webhooks}
          settlements={settlements}
          withdrawals={withdrawals}
          financialTotals={financialTotals}
        />
      )}

      {activeTab === "payments" && (
        <PaymentsPanel payments={payments} />
      )}

      {activeTab === "webhooks" && (
        <WebhooksPanel
          webhooks={webhooks}
          actionLoading={actionLoading}
          onRetry={(id) =>
            void runAction(
              `webhook:${id}`,
              () => retryPaymentWebhook(id),
            )
          }
        />
      )}

      {activeTab === "settlements" && (
        <SettlementsPanel
          settlements={settlements}
          filter={settlementFilter}
          actionLoading={actionLoading}
          onFilter={setSettlementFilter}
          onSubmit={(id) =>
            void runAction(
              `settlement-submit:${id}`,
              () => submitSettlement(id),
            )
          }
          onApprove={(id) =>
            void runAction(
              `settlement-approve:${id}`,
              () => approveSettlement(id),
            )
          }
          onReject={(id) => {
            const reason = window.prompt(
              "Enter the settlement rejection reason:",
            );

            if (!reason?.trim()) return;

            void runAction(
              `settlement-reject:${id}`,
              () => rejectSettlement(id, reason),
            );
          }}
          onResubmit={(id) =>
            void runAction(
              `settlement-resubmit:${id}`,
              () => resubmitSettlement(id),
            )
          }
          onRelease={(id) =>
            void runAction(
              `settlement-release:${id}`,
              () => releaseSettlement(id),
            )
          }
        />
      )}

      {activeTab === "withdrawals" && (
        <WithdrawalsPanel
          withdrawals={withdrawals}
          actionLoading={actionLoading}
          onStatusChange={(id, status) =>
            void runAction(
              `withdrawal:${id}:${status}`,
              () => updateWithdrawalStatus(id, status),
            )
          }
        />
      )}
    </section>
  );
}

function OverviewPanel({
  overview,
  payments,
  webhooks,
  settlements,
  withdrawals,
  financialTotals,
}: {
  overview: FinancialOverview | null;
  payments: FinancialPayment[];
  webhooks: PaymentWebhookEvent[];
  settlements: Settlement[];
  withdrawals: FinancialWithdrawal[];
  financialTotals: {
    grossPayments: string | number;
    successfulPayments: string | number;
    withdrawals: string | number;
  };
}) {
  return (
    <div className="dashboard-grid">
      <div className="panel">
        <div className="panel-header">
          <div>
            <h2>Financial Position</h2>
            <p>Current platform financial activity.</p>
          </div>
        </div>

        <div className="health-list">
          <HealthRow
            label="Payment processing"
            value={`${overview?.payments.pending ?? 0} pending`}
          />

          <HealthRow
            label="Successful payment volume"
            value={formatAmount(
              financialTotals.successfulPayments,
            )}
          />

          <HealthRow
            label="Withdrawal processing"
            value={`${overview?.withdrawals.processing ?? 0} processing`}
          />

          <HealthRow
            label="Completed withdrawals"
            value={String(
              overview?.withdrawals.completed ?? 0,
            )}
          />

          <HealthRow
            label="Financial synchronization"
            value={formatDate(overview?.synchronizedAt)}
          />
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <h2>Control Queues</h2>
            <p>Items requiring financial attention.</p>
          </div>
        </div>

        <div className="health-list">
          <HealthRow
            label="Unprocessed webhooks"
            value={String(
              webhooks.filter((item) => !item.processed).length,
            )}
          />

          <HealthRow
            label="Settlement approvals"
            value={String(
              settlements.filter(
                (item) =>
                  item.status === "AWAITING_APPROVAL",
              ).length,
            )}
          />

          <HealthRow
            label="Rejected settlements"
            value={String(
              settlements.filter(
                (item) => item.status === "REJECTED",
              ).length,
            )}
          />

          <HealthRow
            label="Pending withdrawals"
            value={String(
              overview?.withdrawals.pending ?? 0,
            )}
          />

          <HealthRow
            label="Failed withdrawals"
            value={String(
              overview?.withdrawals.failed ?? 0,
            )}
          />
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <h2>Latest Payments</h2>
            <p>Most recent payment records.</p>
          </div>
        </div>

        {!payments.length ? (
          <EmptyState
            title="No payment records."
            description="No payment operations were returned by the backend."
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Payment</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>

              <tbody>
                {payments.slice(0, 8).map((payment) => (
                  <tr key={payment.id}>
                    <td>{payment.id}</td>
                    <td>
                      {formatAmount(
                        payment.amount,
                        payment.currency,
                      )}
                    </td>
                    <td>
                      <span
                        className={`status-pill ${statusClass(
                          payment.status,
                        )}`}
                      >
                        {payment.status}
                      </span>
                    </td>
                    <td>{formatDate(payment.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <h2>Withdrawal Volume</h2>
            <p>Total withdrawal amount recorded by the backend.</p>
          </div>
        </div>

        <div className="operations-message">
          <strong>
            {formatAmount(financialTotals.withdrawals)}
          </strong>

          <span>
            Total withdrawal volume across returned financial
            records.
          </span>

          <span>
            {withdrawals.length} withdrawal records available.
          </span>
        </div>
      </div>
    </div>
  );
}

function PaymentsPanel({
  payments,
}: {
  payments: FinancialPayment[];
}) {
  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <h2>Payment Operations</h2>
          <p>Payment records returned from the financial API.</p>
        </div>
      </div>

      {!payments.length ? (
        <EmptyState
          title="No payment records returned."
          description="The financial API returned no payment operations."
        />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Payment</th>
                <th>Customer</th>
                <th>Booking</th>
                <th>Provider</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>

            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id}>
                  <td>{payment.id}</td>

                  <td>
                    {payment.customer
                      ? `${payment.customer.firstName} ${payment.customer.lastName}`
                      : payment.customerId ?? "—"}
                  </td>

                  <td>{payment.bookingId ?? "—"}</td>

                  <td>{payment.provider ?? "—"}</td>

                  <td>
                    {formatAmount(
                      payment.amount,
                      payment.currency,
                    )}
                  </td>

                  <td>
                    <span
                      className={`status-pill ${statusClass(
                        payment.status,
                      )}`}
                    >
                      {payment.status}
                    </span>
                  </td>

                  <td>{formatDate(payment.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function WebhooksPanel({
  webhooks,
  actionLoading,
  onRetry,
}: {
  webhooks: PaymentWebhookEvent[];
  actionLoading: string | null;
  onRetry: (id: string) => void;
}) {
  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <h2>Payment Webhook Operations</h2>
          <p>
            Monitor processing state and safely retry unprocessed
            payment events.
          </p>
        </div>
      </div>

      {!webhooks.length ? (
        <EmptyState
          title="No webhook events."
          description="No payment webhook events were returned."
        />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Event</th>
                <th>Type</th>
                <th>Provider</th>
                <th>Payment</th>
                <th>Processing</th>
                <th>Created</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {webhooks.map((event) => {
                const key = `webhook:${event.id}`;

                return (
                  <tr key={event.id}>
                    <td>{event.id}</td>

                    <td>{event.eventType}</td>

                    <td>{event.provider ?? "—"}</td>

                    <td>{event.paymentId ?? "—"}</td>

                    <td>
                      <span
                        className={`status-pill ${
                          event.processed
                            ? "processed"
                            : "pending"
                        }`}
                      >
                        {event.processed
                          ? "PROCESSED"
                          : "UNPROCESSED"}
                      </span>
                    </td>

                    <td>{formatDate(event.createdAt)}</td>

                    <td>
                      {!event.processed && (
                        <button
                          type="button"
                          className="text-button"
                          disabled={actionLoading === key}
                          onClick={() => onRetry(event.id)}
                        >
                          {actionLoading === key
                            ? "Retrying…"
                            : "Retry"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SettlementsPanel({
  settlements,
  filter,
  actionLoading,
  onFilter,
  onSubmit,
  onApprove,
  onReject,
  onResubmit,
  onRelease,
}: {
  settlements: Settlement[];
  filter: SettlementStatus | "";
  actionLoading: string | null;
  onFilter: (value: SettlementStatus | "") => void;
  onSubmit: (id: string) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onResubmit: (id: string) => void;
  onRelease: (id: string) => void;
}) {
  const statuses: SettlementStatus[] = [
    "PENDING",
    "AWAITING_APPROVAL",
    "APPROVED",
    "REJECTED",
    "RELEASED",
    "FAILED",
  ];

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <h2>Settlement Governance</h2>
          <p>
            Review and control the settlement lifecycle backed by
            the settlement service.
          </p>
        </div>

        <select
          value={filter}
          onChange={(event) =>
            onFilter(
              event.target.value as SettlementStatus | "",
            )
          }
        >
          <option value="">All statuses</option>

          {statuses.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>

      {!settlements.length ? (
        <EmptyState
          title="No settlements returned."
          description="No settlement records match the current financial filter."
        />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Settlement</th>
                <th>Transporter</th>
                <th>Booking</th>
                <th>Gross</th>
                <th>Net</th>
                <th>Status</th>
                <th>Created</th>
                <th>Control</th>
              </tr>
            </thead>

            <tbody>
              {settlements.map((settlement) => (
                <tr key={settlement.id}>
                  <td>{settlement.id}</td>

                  <td>
                    {settlement.transporter
                      ? `${settlement.transporter.firstName} ${settlement.transporter.lastName}`
                      : settlement.transporterId}
                  </td>

                  <td>{settlement.bookingId}</td>

                  <td>
                    {formatAmount(
                      settlement.grossAmount,
                      settlement.currency,
                    )}
                  </td>

                  <td>
                    {formatAmount(
                      settlement.netAmount,
                      settlement.currency,
                    )}
                  </td>

                  <td>
                    <span
                      className={`status-pill ${statusClass(
                        settlement.status,
                      )}`}
                    >
                      {settlement.status}
                    </span>
                  </td>

                  <td>{formatDate(settlement.createdAt)}</td>

                  <td>
                    <SettlementActions
                      settlement={settlement}
                      actionLoading={actionLoading}
                      onSubmit={onSubmit}
                      onApprove={onApprove}
                      onReject={onReject}
                      onResubmit={onResubmit}
                      onRelease={onRelease}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SettlementActions({
  settlement,
  actionLoading,
  onSubmit,
  onApprove,
  onReject,
  onResubmit,
  onRelease,
}: {
  settlement: Settlement;
  actionLoading: string | null;
  onSubmit: (id: string) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onResubmit: (id: string) => void;
  onRelease: (id: string) => void;
}) {
  const id = settlement.id;

  if (settlement.status === "PENDING") {
    const key = `settlement-submit:${id}`;

    return (
      <button
        type="button"
        className="text-button"
        disabled={actionLoading === key}
        onClick={() => onSubmit(id)}
      >
        {actionLoading === key ? "Submitting…" : "Submit"}
      </button>
    );
  }

  if (settlement.status === "AWAITING_APPROVAL") {
    return (
      <div className="operations-actions">
        <button
          type="button"
          className="text-button"
          disabled={
            actionLoading === `settlement-approve:${id}`
          }
          onClick={() => onApprove(id)}
        >
          {actionLoading === `settlement-approve:${id}`
            ? "Approving…"
            : "Approve"}
        </button>

        <button
          type="button"
          className="text-button"
          disabled={
            actionLoading === `settlement-reject:${id}`
          }
          onClick={() => onReject(id)}
        >
          {actionLoading === `settlement-reject:${id}`
            ? "Rejecting…"
            : "Reject"}
        </button>
      </div>
    );
  }

  if (settlement.status === "APPROVED") {
    const key = `settlement-release:${id}`;

    return (
      <button
        type="button"
        className="text-button"
        disabled={actionLoading === key}
        onClick={() => onRelease(id)}
      >
        {actionLoading === key ? "Releasing…" : "Release"}
      </button>
    );
  }

  if (settlement.status === "REJECTED") {
    const key = `settlement-resubmit:${id}`;

    return (
      <button
        type="button"
        className="text-button"
        disabled={actionLoading === key}
        onClick={() => onResubmit(id)}
      >
        {actionLoading === key
          ? "Resubmitting…"
          : "Resubmit"}
      </button>
    );
  }

  return <span>—</span>;
}

function WithdrawalsPanel({
  withdrawals,
  actionLoading,
  onStatusChange,
}: {
  withdrawals: FinancialWithdrawal[];
  actionLoading: string | null;
  onStatusChange: (
    id: string,
    status: "PROCESSING" | "COMPLETED" | "FAILED",
  ) => void;
}) {
  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <h2>Withdrawal Operations</h2>
          <p>
            Monitor transporter withdrawals and their processing
            state.
          </p>
        </div>
      </div>

      {!withdrawals.length ? (
        <EmptyState
          title="No withdrawal records."
          description="The financial API returned no withdrawal operations."
        />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Withdrawal</th>
                <th>Transporter</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Created</th>
                <th>Control</th>
              </tr>
            </thead>

            <tbody>
              {withdrawals.map((withdrawal) => {
                const transporter =
                  withdrawal.transporter;

                return (
                  <tr key={withdrawal.id}>
                    <td>{withdrawal.id}</td>

                    <td>
                      {transporter
                        ? `${transporter.firstName} ${transporter.lastName}`
                        : withdrawal.wallet?.transporterId ??
                          "—"}
                    </td>

                    <td>{formatAmount(withdrawal.amount)}</td>

                    <td>
                      <span
                        className={`status-pill ${statusClass(
                          withdrawal.status,
                        )}`}
                      >
                        {withdrawal.status}
                      </span>
                    </td>

                    <td>
                      {formatDate(withdrawal.createdAt)}
                    </td>

                    <td>
                      <WithdrawalActions
                        withdrawal={withdrawal}
                        actionLoading={actionLoading}
                        onStatusChange={onStatusChange}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function WithdrawalActions({
  withdrawal,
  actionLoading,
  onStatusChange,
}: {
  withdrawal: FinancialWithdrawal;
  actionLoading: string | null;
  onStatusChange: (
    id: string,
    status: "PROCESSING" | "COMPLETED" | "FAILED",
  ) => void;
}) {
  if (withdrawal.status === "PENDING") {
    const key = `withdrawal:${withdrawal.id}:PROCESSING`;

    return (
      <button
        type="button"
        className="text-button"
        disabled={actionLoading === key}
        onClick={() =>
          onStatusChange(withdrawal.id, "PROCESSING")
        }
      >
        {actionLoading === key
          ? "Processing…"
          : "Start Processing"}
      </button>
    );
  }

  if (withdrawal.status === "PROCESSING") {
    return (
      <div className="operations-actions">
        <button
          type="button"
          className="text-button"
          disabled={
            actionLoading ===
            `withdrawal:${withdrawal.id}:COMPLETED`
          }
          onClick={() =>
            onStatusChange(withdrawal.id, "COMPLETED")
          }
        >
          Complete
        </button>

        <button
          type="button"
          className="text-button"
          disabled={
            actionLoading ===
            `withdrawal:${withdrawal.id}:FAILED`
          }
          onClick={() =>
            onStatusChange(withdrawal.id, "FAILED")
          }
        >
          Fail
        </button>
      </div>
    );
  }

  return <span>—</span>;
}

function HealthRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="health-row">
      <span>
        <span className="status-dot" />
        {label}
      </span>

      <strong>{value}</strong>
    </div>
  );
}
