import { useEffect, useMemo, useState } from "react";
import {
  getAdminSubscriptions,
  type AdminSubscription,
  type SubscriptionStatus,
} from "../api/subscriptions";

const STATUS_ORDER: SubscriptionStatus[] = [
  "ACTIVE",
  "PENDING",
  "PAST_DUE",
  "CANCELLED",
  "EXPIRED",
];

function formatMoney(
  value: string | number,
  currency: string,
) {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return `${currency} ${value}`;
  }

  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
  }).format(date);
}

function statusClass(status: string) {
  return `subscription-status subscription-status-${status.toLowerCase()}`;
}

function transporterName(subscription: AdminSubscription) {
  const name = [
    subscription.transporter.firstName,
    subscription.transporter.lastName,
  ]
    .filter(Boolean)
    .join(" ");

  return name || "Unknown transporter";
}

export default function Subscriptions() {
  const [subscriptions, setSubscriptions] = useState<
    AdminSubscription[]
  >([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    SubscriptionStatus | "ALL"
  >("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadSubscriptions() {
    try {
      setLoading(true);
      setError("");

      const data = await getAdminSubscriptions();

      setSubscriptions(data);

      setSelectedId((current) => {
        if (current && data.some((item) => item.id === current)) {
          return current;
        }

        return data[0]?.id ?? null;
      });
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load subscription data.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSubscriptions();
  }, []);

  const filteredSubscriptions = useMemo(() => {
    const query = search.trim().toLowerCase();

    return subscriptions.filter((subscription) => {
      const matchesStatus =
        statusFilter === "ALL" ||
        subscription.status === statusFilter;

      if (!matchesStatus) {
        return false;
      }

      if (!query) {
        return true;
      }

      const haystack = [
        transporterName(subscription),
        subscription.transporter.email ?? "",
        subscription.transporter.phone ?? "",
        subscription.plan.name,
        subscription.plan.interval,
        subscription.status,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [subscriptions, search, statusFilter]);

  const selectedSubscription = subscriptions.find(
    (subscription) => subscription.id === selectedId,
  );

  const metrics = useMemo(() => {
    const total = subscriptions.length;

    const byStatus = STATUS_ORDER.reduce(
      (result, status) => {
        result[status] = subscriptions.filter(
          (subscription) => subscription.status === status,
        ).length;

        return result;
      },
      {} as Record<SubscriptionStatus, number>,
    );

    const allInvoices = subscriptions.flatMap(
      (subscription) => subscription.invoices,
    );

    const successfulInvoices = allInvoices.filter(
      (invoice) => invoice.status === "SUCCESS",
    );

    const pendingInvoices = allInvoices.filter(
      (invoice) => invoice.status === "PENDING",
    );

    const processingInvoices = allInvoices.filter(
      (invoice) => invoice.status === "PROCESSING",
    );

    const failedInvoices = allInvoices.filter(
      (invoice) => invoice.status === "FAILED",
    );

    const refundedInvoices = allInvoices.filter(
      (invoice) => invoice.status === "REFUNDED",
    );

    const collected = successfulInvoices.reduce(
      (totalAmount, invoice) =>
        totalAmount + Number(invoice.amount),
      0,
    );

    const pendingAmount = allInvoices
      .filter(
        (invoice) =>
          invoice.status === "PENDING" ||
          invoice.status === "PROCESSING",
      )
      .reduce(
        (totalAmount, invoice) =>
          totalAmount + Number(invoice.amount),
        0,
      );

    const failedAmount = failedInvoices.reduce(
      (totalAmount, invoice) =>
        totalAmount + Number(invoice.amount),
      0,
    );

    const refundedAmount = refundedInvoices.reduce(
      (totalAmount, invoice) =>
        totalAmount + Number(invoice.amount),
      0,
    );

    const activeRate =
      total > 0
        ? (byStatus.ACTIVE / total) * 100
        : 0;

    const now = new Date();
    const thirtyDaysFromNow = new Date(now);
    thirtyDaysFromNow.setDate(
      thirtyDaysFromNow.getDate() + 30,
    );

    const expiringSoon = subscriptions.filter(
      (subscription) => {
        if (subscription.status !== "ACTIVE") {
          return false;
        }

        const end = new Date(
          subscription.currentPeriodEnd,
        );

        return (
          end >= now &&
          end <= thirtyDaysFromNow
        );
      },
    ).length;

    return {
      total,
      byStatus,
      collected,
      pendingAmount,
      failedAmount,
      refundedAmount,
      activeRate,
      expiringSoon,
      collectedCurrency:
        successfulInvoices[0]?.currency ?? "NGN",
      invoiceCount: allInvoices.length,
      successfulInvoiceCount: successfulInvoices.length,
      pendingInvoiceCount: pendingInvoices.length,
      processingInvoiceCount: processingInvoices.length,
      failedInvoiceCount: failedInvoices.length,
      refundedInvoiceCount: refundedInvoices.length,
    };
  }, [subscriptions]);

  if (loading) {
    return (
      <section className="module-shell">
        <div className="module-header">
          <div>
            <span className="module-eyebrow">
              FINANCIAL / SUBSCRIPTION BILLING
            </span>
            <h1>Subscription & Billing</h1>
            <p>
              Loading transporter subscription operations…
            </p>
          </div>
        </div>

        <div className="module-loading">
          Loading subscription records…
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="module-shell">
        <div className="module-header">
          <div>
            <span className="module-eyebrow">
              FINANCIAL / SUBSCRIPTION BILLING
            </span>
            <h1>Subscription & Billing</h1>
            <p>
              Subscription administration could not be loaded.
            </p>
          </div>
        </div>

        <div className="module-error">
          <strong>Unable to load subscriptions</strong>
          <span>{error}</span>

          <button
            type="button"
            onClick={() => void loadSubscriptions()}
          >
            Retry
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="module-shell">
      <div className="module-header">
        <div>
          <span className="module-eyebrow">
            FINANCIAL / SUBSCRIPTION BILLING
          </span>

          <h1>Subscription & Billing</h1>

          <p>
            Monitor transporter commercial plans, billing health,
            and subscription invoice activity across TransConet.
          </p>
        </div>

        <button
          type="button"
          className="module-refresh"
          onClick={() => void loadSubscriptions()}
        >
          Refresh
        </button>
      </div>

      <div className="subscription-metrics">
        <button
          type="button"
          className="subscription-metric"
          onClick={() => setStatusFilter("ALL")}
        >
          <span>Total subscriptions</span>
          <strong>{metrics.total}</strong>
        </button>

        <button
          type="button"
          className="subscription-metric"
          onClick={() => setStatusFilter("ACTIVE")}
        >
          <span>Active</span>
          <strong>{metrics.byStatus.ACTIVE}</strong>
        </button>

        <button
          type="button"
          className="subscription-metric"
          onClick={() => setStatusFilter("PENDING")}
        >
          <span>Pending</span>
          <strong>{metrics.byStatus.PENDING}</strong>
        </button>

        <button
          type="button"
          className="subscription-metric"
          onClick={() => setStatusFilter("PAST_DUE")}
        >
          <span>Past due</span>
          <strong>{metrics.byStatus.PAST_DUE}</strong>
        </button>

        <div className="subscription-metric">
          <span>Successful billing</span>
          <strong>
            {formatMoney(
              metrics.collected,
              metrics.collectedCurrency,
            )}
          </strong>
        </div>
      </div>

      <div className="subscription-billing-health">
        <div className="subscription-billing-health-header">
          <div>
            <span className="module-eyebrow">PAYMENT HEALTH</span>
            <h2>Billing activity</h2>
          </div>
          <span>
            {metrics.invoiceCount} total invoices
          </span>
        </div>

        <div className="subscription-billing-health-grid">
          <button
            type="button"
            className="subscription-health-card subscription-health-success"
          >
            <span>Successful</span>
            <strong>{metrics.successfulInvoiceCount}</strong>
          </button>

          <button
            type="button"
            className="subscription-health-card subscription-health-pending"
          >
            <span>Pending</span>
            <strong>{metrics.pendingInvoiceCount}</strong>
          </button>

          <button
            type="button"
            className="subscription-health-card"
          >
            <span>Processing</span>
            <strong>{metrics.processingInvoiceCount}</strong>
          </button>

          <button
            type="button"
            className="subscription-health-card subscription-health-failed"
          >
            <span>Failed</span>
            <strong>{metrics.failedInvoiceCount}</strong>
          </button>

          <button
            type="button"
            className="subscription-health-card"
          >
            <span>Refunded</span>
            <strong>{metrics.refundedInvoiceCount}</strong>
          </button>
        </div>
      </div>

      <div className="subscription-operations">
        <div className="subscription-operations-header">
          <div>
            <span className="module-eyebrow">
              OPERATIONS / FINANCIAL SIGNALS
            </span>
            <h2>Billing & Subscription Overview</h2>
          </div>

          <span>
            Derived from current subscription and invoice records
          </span>
        </div>

        <div className="subscription-operations-grid">
          <div className="subscription-operation-card">
            <span>Collected</span>
            <strong>
              {formatMoney(
                metrics.collected,
                metrics.collectedCurrency,
              )}
            </strong>
            <small>
              Successful invoices
            </small>
          </div>

          <div className="subscription-operation-card">
            <span>Outstanding</span>
            <strong>
              {formatMoney(
                metrics.pendingAmount,
                metrics.collectedCurrency,
              )}
            </strong>
            <small>
              Pending + processing
            </small>
          </div>

          <div className="subscription-operation-card">
            <span>Failed exposure</span>
            <strong>
              {formatMoney(
                metrics.failedAmount,
                metrics.collectedCurrency,
              )}
            </strong>
            <small>
              Failed invoices
            </small>
          </div>

          <div className="subscription-operation-card">
            <span>Refunded</span>
            <strong>
              {formatMoney(
                metrics.refundedAmount,
                metrics.collectedCurrency,
              )}
            </strong>
            <small>
              Refunded invoices
            </small>
          </div>

          <div className="subscription-operation-card">
            <span>Active rate</span>
            <strong>
              {metrics.activeRate.toFixed(1)}%
            </strong>
            <small>
              Active subscriptions
            </small>
          </div>

          <div className="subscription-operation-card">
            <span>Expiring soon</span>
            <strong>
              {metrics.expiringSoon}
            </strong>
            <small>
              Active plans ending within 30 days
            </small>
          </div>
        </div>
      </div>

      <div className="subscription-workspace">
        <div className="subscription-directory">
          <div className="subscription-directory-header">
            <div>
              <h2>Subscription directory</h2>
              <span>
                {filteredSubscriptions.length} records
              </span>
            </div>

            <div className="subscription-filters">
              <input
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search transporter or plan"
                aria-label="Search subscriptions"
              />

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value as
                      | SubscriptionStatus
                      | "ALL",
                  )
                }
                aria-label="Filter subscriptions by status"
              >
                <option value="ALL">All statuses</option>

                {STATUS_ORDER.map((status) => (
                  <option key={status} value={status}>
                    {status.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {filteredSubscriptions.length === 0 ? (
            <div className="subscription-empty">
              No subscriptions match the current view.
            </div>
          ) : (
            <div className="subscription-table-wrap">
              <table className="subscription-table">
                <thead>
                  <tr>
                    <th>Transporter</th>
                    <th>Plan</th>
                    <th>Status</th>
                    <th>Period</th>
                    <th>Invoices</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredSubscriptions.map(
                    (subscription) => (
                      <tr
                        key={subscription.id}
                        className={
                          subscription.id === selectedId
                            ? "subscription-row-selected"
                            : ""
                        }
                        onClick={() =>
                          setSelectedId(subscription.id)
                        }
                      >
                        <td>
                          <strong>
                            {transporterName(subscription)}
                          </strong>

                          <span>
                            {subscription.transporter.email ??
                              subscription.transporter.phone ??
                              "No contact"}
                          </span>
                        </td>

                        <td>
                          <strong>
                            {subscription.plan.name}
                          </strong>

                          <span>
                            {subscription.plan.interval}
                          </span>
                        </td>

                        <td>
                          <span
                            className={statusClass(
                              subscription.status,
                            )}
                          >
                            {subscription.status.replace(
                              "_",
                              " ",
                            )}
                          </span>
                        </td>

                        <td>
                          <strong>
                            {formatDate(
                              subscription.currentPeriodEnd,
                            )}
                          </strong>

                          <span>
                            started{" "}
                            {formatDate(
                              subscription.currentPeriodStart,
                            )}
                          </span>
                        </td>

                        <td>
                          <strong>
                            {subscription.invoices.length}
                          </strong>

                          <span>
                            {
                              subscription.invoices.filter(
                                (invoice) =>
                                  invoice.status === "SUCCESS",
                              ).length
                            } paid
                          </span>
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <aside className="subscription-detail">
          {!selectedSubscription ? (
            <div className="subscription-empty">
              Select a subscription to inspect its billing
              activity.
            </div>
          ) : (
            <>
              <div className="subscription-detail-header">
                <span className="module-eyebrow">
                  SUBSCRIPTION RECORD
                </span>

                <h2>
                  {transporterName(selectedSubscription)}
                </h2>

                <span
                  className={statusClass(
                    selectedSubscription.status,
                  )}
                >
                  {selectedSubscription.status.replace(
                    "_",
                    " ",
                  )}
                </span>
              </div>

              <div className="subscription-detail-grid">
                <div>
                  <span>Plan</span>
                  <strong>
                    {selectedSubscription.plan.name}
                  </strong>
                </div>

                <div>
                  <span>Billing interval</span>
                  <strong>
                    {selectedSubscription.plan.interval}
                  </strong>
                </div>

                <div>
                  <span>Plan price</span>
                  <strong>
                    {formatMoney(
                      selectedSubscription.plan.price,
                      selectedSubscription.plan.currency,
                    )}
                  </strong>
                </div>

                <div>
                  <span>Transporter tier</span>
                  <strong>
                    {selectedSubscription.transporter
                      .transporterTier ?? "—"}
                  </strong>
                </div>

                <div>
                  <span>Current period</span>
                  <strong>
                    {formatDate(
                      selectedSubscription.currentPeriodStart,
                    )}
                    {" → "}
                    {formatDate(
                      selectedSubscription.currentPeriodEnd,
                    )}
                  </strong>
                </div>

                <div>
                  <span>Started</span>
                  <strong>
                    {formatDate(
                      selectedSubscription.startedAt,
                    )}
                  </strong>
                </div>
              </div>

              <div className="subscription-invoices">
                <div className="subscription-section-title">
                  <div>
                    <h3>Billing history</h3>
                    <span>
                      {selectedSubscription.invoices.length}{" "}
                      invoices
                    </span>
                  </div>
                </div>

                {selectedSubscription.invoices.length === 0 ? (
                  <div className="subscription-empty">
                    No invoices recorded.
                  </div>
                ) : (
                  <div className="subscription-invoice-list">
                    {selectedSubscription.invoices.map(
                      (invoice) => (
                        <div
                          className="subscription-invoice"
                          key={invoice.id}
                        >
                          <div>
                            <strong>
                              {formatMoney(
                                invoice.amount,
                                invoice.currency,
                              )}
                            </strong>

                            <span>
                              {invoice.plan?.name ??
                                selectedSubscription.plan.name}
                            </span>
                          </div>

                          <div>
                            <span
                              className={statusClass(
                                invoice.status,
                              )}
                            >
                              {invoice.status.replace(
                                "_",
                                " ",
                              )}
                            </span>

                            <small>
                              {formatDate(invoice.createdAt)}
                            </small>
                          </div>

                          <div>
                            <span>Billing period</span>
                            <strong>
                              {formatDate(
                                invoice.periodStart,
                              )}{" "}
                              →{" "}
                              {formatDate(invoice.periodEnd)}
                            </strong>
                          </div>

                          <div>
                            <span>Provider</span>
                            <strong>
                              {invoice.provider}
                            </strong>
                          </div>

                          <div>
                            <span>Reference</span>
                            <strong>
                              {invoice.transactionReference ??
                                "Pending"}
                            </strong>
                          </div>

                          <div>
                            <span>Paid</span>
                            <strong>
                              {formatDate(invoice.paidAt)}
                            </strong>
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </aside>
      </div>
    </section>
  );
}
