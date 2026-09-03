import { useEffect, useMemo, useState } from "react";
import {
  getAdminSubscriptions,
  getAdminSubscriptionPlans,
  createAdminSubscriptionPlan,
  updateAdminSubscriptionPlan,
  updateAdminSubscriptionPlanStatus,
  getSubscriptionVisibilityConfig,
  updateSubscriptionVisibilityConfig,
  type AdminSubscription,
  type SubscriptionPlan,
  type AdminSubscriptionPlanName,
  type MarketplaceVisibilityConfig,
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
  const [visibilityConfig, setVisibilityConfig] =
    useState<MarketplaceVisibilityConfig | null>(null);
  const [visibilityLoading, setVisibilityLoading] =
    useState(true);
  const [visibilitySaving, setVisibilitySaving] =
    useState(false);
  const [visibilityError, setVisibilityError] =
    useState("");
  const [visibilitySaved, setVisibilitySaved] =
    useState(false);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansSaving, setPlansSaving] = useState(false);
  const [plansError, setPlansError] = useState("");
  const [newPlanName, setNewPlanName] =
    useState<AdminSubscriptionPlanName>("FREE");
  const [newPlanDescription, setNewPlanDescription] = useState("");
  const [newPlanPrice, setNewPlanPrice] = useState("");
  const [newPlanCurrency, setNewPlanCurrency] = useState("NGN");
  const [newPlanInterval, setNewPlanInterval] =
    useState<SubscriptionPlan["interval"]>("MONTHLY");
  const [newPlanBenefits, setNewPlanBenefits] = useState("");
  const [newPlanActive, setNewPlanActive] = useState(true);
  const [planSaved, setPlanSaved] = useState(false);

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

  useEffect(() => {
    async function loadPlans() {
      try {
        setPlansLoading(true);
        setPlansError("");

        const data = await getAdminSubscriptionPlans();
        setPlans(data);
      } catch (requestError) {
        setPlansError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load subscription plans.",
        );
      } finally {
        setPlansLoading(false);
      }
    }

    void loadPlans();
  }, []);

  useEffect(() => {
    async function loadVisibilityConfig() {
      try {
        setVisibilityLoading(true);
        setVisibilityError("");

        const config =
          await getSubscriptionVisibilityConfig();

        setVisibilityConfig(config.value);
      } catch (requestError) {
        setVisibilityError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load marketplace visibility configuration.",
        );
      } finally {
        setVisibilityLoading(false);
      }
    }

    void loadVisibilityConfig();
  }, []);

  async function saveVisibilityConfig() {
    if (!visibilityConfig) {
      return;
    }

    try {
      setVisibilitySaving(true);
      setVisibilityError("");
      setVisibilitySaved(false);

      const updated =
        await updateSubscriptionVisibilityConfig(
          visibilityConfig,
        );

      setVisibilityConfig(updated.value);
      setVisibilitySaved(true);
    } catch (requestError) {
      setVisibilityError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to save marketplace visibility configuration.",
      );
    } finally {
      setVisibilitySaving(false);
    }
  }

  async function createPlan() {
    const price = Number(newPlanPrice);

    if (!Number.isFinite(price) || price < 0) {
      setPlansError("Enter a valid non-negative subscription price.");
      return;
    }

    if (newPlanName === "FREE" && price !== 0) {
      setPlansError("FREE plan must have a zero price.");
      return;
    }

    if (newPlanName !== "FREE" && price <= 0) {
      setPlansError("Paid subscription plans must have a positive price.");
      return;
    }

    try {
      setPlansSaving(true);
      setPlansError("");
      setPlanSaved(false);

      const created = await createAdminSubscriptionPlan({
        name: newPlanName,
        description: newPlanDescription.trim() || null,
        price,
        currency: newPlanCurrency.trim().toUpperCase(),
        interval: newPlanInterval,
        features: {
          benefits: newPlanBenefits
            .split("\n")
            .map((value) => value.trim())
            .filter(Boolean),
        },
        active: newPlanActive,
      });

      setPlans((current) =>
        [...current, created].sort(
          (a, b) => Number(a.price) - Number(b.price),
        ),
      );

      setNewPlanDescription("");
      setNewPlanPrice("");
      setNewPlanBenefits("");
      setPlanSaved(true);
    } catch (requestError) {
      setPlansError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to create subscription plan.",
      );
    } finally {
      setPlansSaving(false);
    }
  }

  async function savePlan(plan: SubscriptionPlan) {
    try {
      setPlansSaving(true);
      setPlansError("");
      setPlanSaved(false);

      const updated = await updateAdminSubscriptionPlan(
        plan.id,
        {
          description: plan.description ?? null,
          price: Number(plan.price),
          currency: plan.currency,
          interval: plan.interval,
          features:
            plan.features &&
            typeof plan.features === "object" &&
            "benefits" in plan.features &&
            Array.isArray(
              (plan.features as { benefits?: unknown }).benefits,
            )
              ? {
                  benefits: (
                    plan.features as { benefits: string[] }
                  ).benefits,
                }
              : { benefits: [] },
          active: plan.active,
        },
      );

      setPlans((current) =>
        current.map((item) =>
          item.id === updated.id ? updated : item,
        ),
      );
      setPlanSaved(true);
    } catch (requestError) {
      setPlansError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to save subscription plan.",
      );
    } finally {
      setPlansSaving(false);
    }
  }

  async function togglePlan(plan: SubscriptionPlan) {
    try {
      setPlansSaving(true);
      setPlansError("");

      const updated = await updateAdminSubscriptionPlanStatus(
        plan.id,
        !plan.active,
      );

      setPlans((current) =>
        current.map((item) =>
          item.id === updated.id ? updated : item,
        ),
      );
    } catch (requestError) {
      setPlansError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to update subscription plan status.",
      );
    } finally {
      setPlansSaving(false);
    }
  }

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

      <div className="subscription-plan-management">
        <div className="subscription-plan-management-header">
          <div>
            <span className="module-eyebrow">
              SUBSCRIPTION / PLAN CONFIGURATION
            </span>
            <h2>Transporter Subscription Plans</h2>
            <p>
              Configure the plans, prices, billing intervals, and
              benefits available to transporters. Prices are stored
              in the subscription plan records and are never
              hardcoded in the transporter app.
            </p>
          </div>
        </div>

        {!plansLoading && (
          <div className="subscription-plan-create">
            <div className="subscription-plan-create-header">
              <div>
                <span className="module-eyebrow">
                  ADMIN ACTION
                </span>
                <h3>Configure a New Plan</h3>
                <p>
                  Create a missing transporter subscription plan.
                  Set the actual price and benefits here; nothing is
                  hardcoded in the transporter app.
                </p>
              </div>
            </div>

            <div className="subscription-plan-form">
              <label>
                Plan
                <select
                  value={newPlanName}
                  onChange={(event) =>
                    setNewPlanName(
                      event.target.value as AdminSubscriptionPlanName,
                    )
                  }
                >
                  {(
                    [
                      "FREE",
                      "SILVER",
                      "GOLD",
                      "PLATINUM",
                      "ENTERPRISE",
                    ] as const
                  )
                    .filter(
                      (name) =>
                        !plans.some((plan) => plan.name === name),
                    )
                    .map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                </select>
              </label>

              <label>
                Description
                <textarea
                  value={newPlanDescription}
                  rows={3}
                  placeholder="Describe this subscription plan"
                  onChange={(event) =>
                    setNewPlanDescription(event.target.value)
                  }
                />
              </label>

              <div className="subscription-plan-form-row">
                <label>
                  Price
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newPlanPrice}
                    placeholder="Enter price"
                    onChange={(event) =>
                      setNewPlanPrice(event.target.value)
                    }
                  />
                </label>

                <label>
                  Currency
                  <input
                    type="text"
                    maxLength={10}
                    value={newPlanCurrency}
                    onChange={(event) =>
                      setNewPlanCurrency(event.target.value)
                    }
                  />
                </label>

                <label>
                  Billing interval
                  <select
                    value={newPlanInterval}
                    onChange={(event) =>
                      setNewPlanInterval(
                        event.target.value as SubscriptionPlan["interval"],
                      )
                    }
                  >
                    <option value="MONTHLY">MONTHLY</option>
                    <option value="YEARLY">YEARLY</option>
                  </select>
                </label>
              </div>

              <label>
                Benefits
                <textarea
                  value={newPlanBenefits}
                  rows={4}
                  placeholder="One benefit per line"
                  onChange={(event) =>
                    setNewPlanBenefits(event.target.value)
                  }
                />
              </label>

              <label className="subscription-plan-checkbox">
                <input
                  type="checkbox"
                  checked={newPlanActive}
                  onChange={(event) =>
                    setNewPlanActive(event.target.checked)
                  }
                />
                Active immediately
              </label>

              <div className="subscription-plan-actions">
                <button
                  type="button"
                  className="module-refresh"
                  disabled={
                    plansSaving ||
                    plans.some((plan) => plan.name === newPlanName)
                  }
                  onClick={() => void createPlan()}
                >
                  {plansSaving ? "Creating..." : "Create Plan"}
                </button>
              </div>
            </div>
          </div>
        )}

        {plansLoading ? (
          <div className="subscription-empty">
            Loading subscription plans...
          </div>
        ) : plansError && plans.length === 0 ? (
          <div className="module-error">
            <strong>Unable to load subscription plans</strong>
            <span>{plansError}</span>
          </div>
        ) : (
          <>
            <div className="subscription-plan-grid">
              {(
                [
                  "FREE",
                  "SILVER",
                  "GOLD",
                  "PLATINUM",
                  "ENTERPRISE",
                ] as const
              ).map((planName) => {
                const plan = plans.find(
                  (item) => item.name === planName,
                );

                if (!plan) {
                  return (
                    <div
                      key={planName}
                      className="subscription-plan-card subscription-plan-missing"
                    >
                      <strong>{planName}</strong>
                      <span>
                        This plan has not been configured yet.
                      </span>
                    </div>
                  );
                }

                const benefits =
                  plan.features &&
                  typeof plan.features === "object" &&
                  "benefits" in plan.features &&
                  Array.isArray(
                    (plan.features as { benefits?: unknown }).benefits,
                  )
                    ? (
                        plan.features as {
                          benefits: string[];
                        }
                      ).benefits
                    : [];

                return (
                  <div
                    key={plan.id}
                    className="subscription-plan-card"
                  >
                    <div className="subscription-plan-card-header">
                      <div>
                        <span className="module-eyebrow">
                          {planName}
                        </span>
                        <h3>{plan.name}</h3>
                      </div>

                      <button
                        type="button"
                        className="subscription-plan-status"
                        onClick={() => void togglePlan(plan)}
                        disabled={plansSaving}
                      >
                        {plan.active
                          ? "ACTIVE"
                          : "INACTIVE"}
                      </button>
                    </div>

                    <label>
                      Description
                      <textarea
                        value={plan.description ?? ""}
                        onChange={(event) =>
                          setPlans((current) =>
                            current.map((item) =>
                              item.id === plan.id
                                ? {
                                    ...item,
                                    description:
                                      event.target.value,
                                  }
                                : item,
                            ),
                          )
                        }
                        rows={2}
                      />
                    </label>

                    <div className="subscription-plan-fields">
                      <label>
                        Price
                        <input
                          type="number"
                          min={plan.name === "FREE" ? 0 : 0.01}
                          step="0.01"
                          value={plan.price}
                          onChange={(event) =>
                            setPlans((current) =>
                              current.map((item) =>
                                item.id === plan.id
                                  ? {
                                      ...item,
                                      price:
                                        event.target.value,
                                    }
                                  : item,
                              ),
                            )
                          }
                        />
                      </label>

                      <label>
                        Currency
                        <input
                          value={plan.currency}
                          onChange={(event) =>
                            setPlans((current) =>
                              current.map((item) =>
                                item.id === plan.id
                                  ? {
                                      ...item,
                                      currency:
                                        event.target.value.toUpperCase(),
                                    }
                                  : item,
                              ),
                            )
                          }
                        />
                      </label>

                      <label>
                        Billing interval
                        <select
                          value={plan.interval}
                          onChange={(event) =>
                            setPlans((current) =>
                              current.map((item) =>
                                item.id === plan.id
                                  ? {
                                      ...item,
                                      interval:
                                        event.target
                                          .value as
                                          | "MONTHLY"
                                          | "YEARLY",
                                    }
                                  : item,
                              ),
                            )
                          }
                        >
                          <option value="MONTHLY">
                            Monthly
                          </option>
                          <option value="YEARLY">
                            Yearly
                          </option>
                        </select>
                      </label>
                    </div>

                    <label>
                      Benefits
                      <textarea
                        value={benefits.join("\n")}
                        placeholder="One benefit per line"
                        rows={4}
                        onChange={(event) => {
                          const nextBenefits =
                            event.target.value
                              .split("\n")
                              .map((value) => value.trim())
                              .filter(Boolean);

                          setPlans((current) =>
                            current.map((item) =>
                              item.id === plan.id
                                ? {
                                    ...item,
                                    features: {
                                      benefits:
                                        nextBenefits,
                                    },
                                  }
                                : item,
                            ),
                          );
                        }}
                      />
                    </label>

                    <div className="subscription-plan-actions">
                      <button
                        type="button"
                        className="module-refresh"
                        disabled={plansSaving}
                        onClick={() => void savePlan(plan)}
                      >
                        {plansSaving
                          ? "Saving..."
                          : "Save Plan"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {plansError && (
              <div className="module-error">
                <span>{plansError}</span>
              </div>
            )}

            {planSaved && (
              <div className="subscription-plan-saved">
                Subscription plan configuration saved.
              </div>
            )}
          </>
        )}
      </div>

      <div className="subscription-visibility">
        <div className="subscription-visibility-header">
          <div>
            <span className="module-eyebrow">
              MARKETPLACE / LOAD VISIBILITY
            </span>
            <h2>Load Visibility Algorithm Controls</h2>
            <p>
              Control how subscription level, transporter tier,
              distance, and eligibility affect the loads a
              transporter can discover.
            </p>
          </div>
        </div>

        {visibilityLoading ? (
          <div className="subscription-empty">
            Loading visibility configuration...
          </div>
        ) : visibilityError && !visibilityConfig ? (
          <div className="module-error">
            <strong>Unable to load visibility configuration</strong>
            <span>{visibilityError}</span>
          </div>
        ) : visibilityConfig ? (
          <>
            <div className="subscription-visibility-grid">
              <div className="subscription-visibility-card">
                <span>Discovery Radius</span>

                <label>
                  Default radius (km)
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={visibilityConfig.defaultRadiusKm}
                    onChange={(event) =>
                      setVisibilityConfig({
                        ...visibilityConfig,
                        defaultRadiusKm: Number(
                          event.target.value,
                        ),
                      })
                    }
                  />
                </label>

                <label>
                  Maximum radius (km)
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={visibilityConfig.maxRadiusKm}
                    onChange={(event) =>
                      setVisibilityConfig({
                        ...visibilityConfig,
                        maxRadiusKm: Number(
                          event.target.value,
                        ),
                      })
                    }
                  />
                </label>
              </div>

              <div className="subscription-visibility-card">
                <span>Subscription Visibility Boost</span>

                {(
                  [
                    "FREE",
                    "SILVER",
                    "GOLD",
                    "PLATINUM",
                    "ENTERPRISE",
                  ] as const
                ).map((plan) => (
                  <label key={plan}>
                    {plan}
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={
                        visibilityConfig.subscriptionBoosts[
                          plan
                        ]
                      }
                      onChange={(event) =>
                        setVisibilityConfig({
                          ...visibilityConfig,
                          subscriptionBoosts: {
                            ...visibilityConfig.subscriptionBoosts,
                            [plan]: Number(
                              event.target.value,
                            ),
                          },
                        })
                      }
                    />
                  </label>
                ))}
              </div>

              <div className="subscription-visibility-card">
                <span>Transporter Ranking Scores</span>

                <label>
                  TIER_1
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={
                      visibilityConfig.tierScores.TIER_1
                    }
                    onChange={(event) =>
                      setVisibilityConfig({
                        ...visibilityConfig,
                        tierScores: {
                          ...visibilityConfig.tierScores,
                          TIER_1: Number(
                            event.target.value,
                          ),
                        },
                      })
                    }
                  />
                </label>

                <label>
                  TIER_2
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={
                      visibilityConfig.tierScores.TIER_2
                    }
                    onChange={(event) =>
                      setVisibilityConfig({
                        ...visibilityConfig,
                        tierScores: {
                          ...visibilityConfig.tierScores,
                          TIER_2: Number(
                            event.target.value,
                          ),
                        },
                      })
                    }
                  />
                </label>
              </div>

              <div className="subscription-visibility-card">
                <span>Eligibility Requirements</span>

                <label>
                  <input
                    type="checkbox"
                    checked={
                      visibilityConfig.requireApprovedTransporter
                    }
                    onChange={(event) =>
                      setVisibilityConfig({
                        ...visibilityConfig,
                        requireApprovedTransporter:
                          event.target.checked,
                      })
                    }
                  />
                  Approved transporter
                </label>

                <label>
                  <input
                    type="checkbox"
                    checked={
                      visibilityConfig.requireApprovedVehicle
                    }
                    onChange={(event) =>
                      setVisibilityConfig({
                        ...visibilityConfig,
                        requireApprovedVehicle:
                          event.target.checked,
                      })
                    }
                  />
                  Approved vehicle
                </label>

                <label>
                  <input
                    type="checkbox"
                    checked={
                      visibilityConfig.requireAvailableVehicle
                    }
                    onChange={(event) =>
                      setVisibilityConfig({
                        ...visibilityConfig,
                        requireAvailableVehicle:
                          event.target.checked,
                      })
                    }
                  />
                  Available vehicle
                </label>

                <label>
                  <input
                    type="checkbox"
                    checked={
                      visibilityConfig.requireVehicleLocation
                    }
                    onChange={(event) =>
                      setVisibilityConfig({
                        ...visibilityConfig,
                        requireVehicleLocation:
                          event.target.checked,
                      })
                    }
                  />
                  Vehicle location required
                </label>
              </div>
            </div>

            {visibilityError && (
              <div className="module-error">
                <span>{visibilityError}</span>
              </div>
            )}

            <div className="subscription-visibility-actions">
              <button
                type="button"
                className="module-refresh"
                onClick={() => void saveVisibilityConfig()}
                disabled={visibilitySaving}
              >
                {visibilitySaving
                  ? "Saving..."
                  : "Save Visibility Controls"}
              </button>

              {visibilitySaved && (
                <span>Visibility configuration saved.</span>
              )}
            </div>
          </>
        ) : null}
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
