import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getMarketplaceBids,
  getMarketplaceRequest,
  getMarketplaceRequests,
  getMarketplaceSummary,
  getMarketplacePricing,
  updateMarketplacePricing,
  getMarketplaceCommissionRules,
  createMarketplaceCommissionRule,
  updateMarketplaceCommissionRule,
  updateMarketplaceCommissionRuleStatus,
  type MarketplaceBid,
  type MarketplaceRequest,
  type MarketplaceRequestStatus,
  type MarketplaceSummary,
  type MarketplacePricing,
  type MarketplacePricingConfig,
  type MarketplaceCommissionRule,
  type MarketplaceCommissionRuleInput,
} from "../api/marketplace";

function labelize(value: string | null | undefined) {
  if (!value) return "—";

  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function statusClass(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function money(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";

  return `₦${Number(value).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function dateTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function person(
  value: { firstName: string; lastName: string } | null | undefined,
) {
  if (!value) return "Unavailable";
  return `${value.firstName} ${value.lastName}`.trim();
}

const requestStatuses: Array<MarketplaceRequestStatus | ""> = [
  "",
  "OPEN",
  "BIDDING_CLOSED",
  "AGREED",
  "CANCELLED",
  "EXPIRED",
];

const bidStatuses = [
  "",
  "PENDING",
  "SELECTED",
  "REJECTED",
  "WITHDRAWN",
  "EXPIRED",
];

export default function Marketplace() {
  const [summary, setSummary] = useState<MarketplaceSummary | null>(null);
  const [requests, setRequests] = useState<MarketplaceRequest[]>([]);
  const [bids, setBids] = useState<MarketplaceBid[]>([]);

  const [selectedRequest, setSelectedRequest] =
    useState<MarketplaceRequest | null>(null);

  const [requestSearch, setRequestSearch] = useState("");
  const [requestStatus, setRequestStatus] = useState("");
  const [bidSearch, setBidSearch] = useState("");
  const [bidStatus, setBidStatus] = useState("");

  const [requestPage, setRequestPage] = useState(1);
  const [bidPage, setBidPage] = useState(1);

  const [requestPages, setRequestPages] = useState(1);
  const [bidPages, setBidPages] = useState(1);

  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");

  const [pricing, setPricing] = useState<MarketplacePricing | null>(null);
  const [pricingForm, setPricingForm] =
    useState<MarketplacePricingConfig | null>(null);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [pricingSaving, setPricingSaving] = useState(false);
  const [pricingError, setPricingError] = useState("");
  const [pricingSuccess, setPricingSuccess] = useState("");

  const [commissionRules, setCommissionRules] = useState<
    MarketplaceCommissionRule[]
  >([]);
  const [commissionLoading, setCommissionLoading] = useState(false);
  const [commissionSaving, setCommissionSaving] = useState(false);
  const [commissionError, setCommissionError] = useState("");
  const [commissionSuccess, setCommissionSuccess] = useState("");
  const [commissionEditingId, setCommissionEditingId] = useState<string | null>(
    null,
  );
  const [commissionForm, setCommissionForm] =
    useState<MarketplaceCommissionRuleInput>({
      name: "",
      description: "",
      type: "PERCENTAGE",
      rate: 5,
      currency: "NGN",
      minAmount: null,
      maxAmount: null,
      transporterTier: null,
    });

  const loadMarketplace = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [summaryData, requestData, bidData] = await Promise.all([
        getMarketplaceSummary(),
        getMarketplaceRequests({
          search: requestSearch || undefined,
          status: requestStatus || undefined,
          page: requestPage,
          limit: 12,
        }),
        getMarketplaceBids({
          search: bidSearch || undefined,
          status: bidStatus || undefined,
          page: bidPage,
          limit: 12,
        }),
      ]);

      setSummary(summaryData);
      setRequests(requestData.requests ?? []);
      setBids(bidData.bids ?? []);
      setRequestPages(requestData.pagination.totalPages);
      setBidPages(bidData.pagination.totalPages);

      if (
        selectedRequest &&
        !(requestData.requests ?? []).some(
          (request) => request.id === selectedRequest.id,
        )
      ) {
        setSelectedRequest(null);
      }
    } catch {
      setError("Unable to load Fleet Marketplace data.");
    } finally {
      setLoading(false);
    }
  }, [
    requestSearch,
    requestStatus,
    requestPage,
    bidSearch,
    bidStatus,
    bidPage,
    selectedRequest,
  ]);

  const loadMarketplacePricing = useCallback(async () => {
    try {
      setPricingLoading(true);
      setPricingError("");

      const data = await getMarketplacePricing();

      setPricing(data);
      setPricingForm(data?.value ?? null);
    } catch {
      setPricingError("Unable to load fare configuration.");
    } finally {
      setPricingLoading(false);
    }
  }, []);

  const loadCommissionRules = useCallback(async () => {
    try {
      setCommissionLoading(true);
      setCommissionError("");
      const data = await getMarketplaceCommissionRules();
      setCommissionRules(data);
    } catch {
      setCommissionError("Unable to load commission rules.");
    } finally {
      setCommissionLoading(false);
    }
  }, []);

  async function saveCommissionRule() {
    try {
      setCommissionSaving(true);
      setCommissionError("");
      setCommissionSuccess("");

      if (commissionEditingId) {
        const updated = await updateMarketplaceCommissionRule(
          commissionEditingId,
          commissionForm,
        );
        setCommissionRules((current) =>
          current.map((rule) => (rule.id === updated.id ? updated : rule)),
        );
        setCommissionSuccess("Commission rule updated successfully.");
      } else {
        const created = await createMarketplaceCommissionRule(commissionForm);
        setCommissionRules((current) => [created, ...current]);
        setCommissionSuccess("Commission rule created successfully.");
      }

      setCommissionEditingId(null);
      setCommissionForm({
        name: "",
        description: "",
        type: "PERCENTAGE",
        rate: 5,
        currency: "NGN",
        minAmount: null,
        maxAmount: null,
        transporterTier: null,
      });
    } catch {
      setCommissionError(
        "Unable to save commission rule. Check the values and try again.",
      );
    } finally {
      setCommissionSaving(false);
    }
  }

  async function toggleCommissionRule(rule: MarketplaceCommissionRule) {
    try {
      setCommissionError("");
      setCommissionSuccess("");

      const updated = await updateMarketplaceCommissionRuleStatus(
        rule.id,
        rule.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
      );

      setCommissionRules((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setCommissionSuccess(
        updated.status === "ACTIVE"
          ? "Commission rule activated."
          : "Commission rule deactivated.",
      );
    } catch {
      setCommissionError("Unable to update commission rule status.");
    }
  }

  function editCommissionRule(rule: MarketplaceCommissionRule) {
    setCommissionEditingId(rule.id);
    setCommissionForm({
      name: rule.name,
      description: rule.description,
      type: rule.type,
      rate: Number(rule.rate),
      currency: rule.currency ?? "NGN",
      minAmount:
        rule.minAmount === null ? null : Number(rule.minAmount),
      maxAmount:
        rule.maxAmount === null ? null : Number(rule.maxAmount),
      transporterTier: rule.transporterTier,
      effectiveFrom: rule.effectiveFrom,
      effectiveTo: rule.effectiveTo,
    });
    setCommissionError("");
    setCommissionSuccess("");
  }

  function resetCommissionForm() {
    setCommissionEditingId(null);
    setCommissionForm({
      name: "",
      description: "",
      type: "PERCENTAGE",
      rate: 5,
      currency: "NGN",
      minAmount: null,
      maxAmount: null,
      transporterTier: null,
    });
    setCommissionError("");
    setCommissionSuccess("");
  }

  async function saveMarketplacePricing() {
    if (!pricingForm) return;

    try {
      setPricingSaving(true);
      setPricingError("");
      setPricingSuccess("");

      const updated = await updateMarketplacePricing(
        pricingForm,
        pricing?.description ?? "Fleet Marketplace fare calculation configuration",
      );

      setPricing(updated);
      setPricingForm(updated.value);
      setPricingSuccess("Fare configuration saved successfully.");
    } catch {
      setPricingError(
        "Unable to save fare configuration. Check the values and try again.",
      );
    } finally {
      setPricingSaving(false);
    }
  }

  async function openRequest(id: string) {
    try {
      setDetailLoading(true);
      setError("");

      const request = await getMarketplaceRequest(id);
      setSelectedRequest(request);
    } catch {
      setError("Unable to load marketplace request.");
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    // Intentional: synchronize component state with the backend API.
    void loadMarketplace();
  }, [loadMarketplace]);

  useEffect(() => {
    void loadMarketplacePricing();
    void loadCommissionRules();
  }, [loadMarketplacePricing, loadCommissionRules]);

  const selectedBidId = selectedRequest?.agreedBidId;

  const rankedBids = useMemo(() => {
    if (!selectedRequest) return [];

    return [...selectedRequest.bids].sort((a, b) => {
      if (a.id === selectedBidId) return -1;
      if (b.id === selectedBidId) return 1;
      return Number(a.amount) - Number(b.amount);
    });
  }, [selectedRequest, selectedBidId]);

  if (selectedRequest) {
    return (
      <section className="dashboard">
        <div className="module-header">
          <div>
            <button
              type="button"
              className="customer-back-button"
              onClick={() => setSelectedRequest(null)}
            >
              ← Fleet Marketplace
            </button>

            <div className="module-kicker">
              MARKETPLACE / REQUEST INTELLIGENCE
            </div>

            <h2>
              {selectedRequest.pickupLocation} →{" "}
              {selectedRequest.destination}
            </h2>

            <p>
              Request {selectedRequest.id} ·{" "}
              {selectedRequest.bidCount} bid
              {selectedRequest.bidCount === 1 ? "" : "s"}
            </p>
          </div>

          <span
            className={`status-pill ${statusClass(selectedRequest.status)}`}
          >
            {labelize(selectedRequest.status)}
          </span>
        </div>

        {error && (
          <div className="panel customer-state error-state">
            {error}
          </div>
        )}

        {detailLoading ? (
          <div className="panel customer-state">
            Loading marketplace request…
          </div>
        ) : (
          <div className="customer-layout">
            <aside className="customer-subnav panel">
              <div className="customer-identity">
                <div className="customer-avatar">
                  {selectedRequest.id.slice(0, 2).toUpperCase()}
                </div>

                <strong>
                  {person(selectedRequest.customer)}
                </strong>

                <span>
                  {selectedRequest.customer?.email ?? "No email"}
                </span>

                <span>
                  {selectedRequest.customer?.phone ?? "No phone"}
                </span>
              </div>

              <div className="customer-actions">
                <strong>Marketplace State</strong>

                <span
                  className={`status-pill ${statusClass(
                    selectedRequest.status,
                  )}`}
                >
                  {labelize(selectedRequest.status)}
                </span>
              </div>
            </aside>

            <div className="customer-content">
              <div className="section-title">
                <h3>Load Profile</h3>
                <span>
                  The operational data behind this marketplace request
                </span>
              </div>

              <div className="panel customer-detail-panel">
                <div className="detail-grid">
                  <div>
                    <span>Cargo</span>
                    <strong>
                      {selectedRequest.cargoDescription || "—"}
                    </strong>
                  </div>

                  <div>
                    <span>Cargo Category</span>
                    <strong>
                      {labelize(selectedRequest.cargoCategory)}
                    </strong>
                  </div>

                  <div>
                    <span>Truck Category</span>
                    <strong>
                      {labelize(selectedRequest.truckCategory)}
                    </strong>
                  </div>

                  <div>
                    <span>Cargo Weight</span>
                    <strong>
                      {selectedRequest.cargoWeight
                        ? `${Number(selectedRequest.cargoWeight).toLocaleString()}`
                        : "—"}
                    </strong>
                  </div>

                  <div>
                    <span>Estimated Fare</span>
                    <strong>{money(selectedRequest.estimatedFare)}</strong>
                  </div>

                  <div>
                    <span>Scheduled</span>
                    <strong>
                      {dateTime(selectedRequest.scheduledDate)}
                    </strong>
                  </div>

                  <div>
                    <span>Created</span>
                    <strong>
                      {dateTime(selectedRequest.createdAt)}
                    </strong>
                  </div>

                  <div>
                    <span>Booking</span>
                    <strong>
                      {selectedRequest.booking
                        ? selectedRequest.booking.id
                        : "Not booked"}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="section-title">
                <h3>Bid Intelligence</h3>
                <span>
                  Transporters competing for this load
                </span>
              </div>

              <div className="panel">
                {rankedBids.length === 0 ? (
                  <div className="empty-activity">
                    <strong>No bids</strong>
                    <span>
                      No transporter bids have been recorded for this
                      request.
                    </span>
                  </div>
                ) : (
                  <div className="operations-table-wrap">
                    <table className="operations-table">
                      <thead>
                        <tr>
                          <th>State</th>
                          <th>Transporter</th>
                          <th>Vehicle</th>
                          <th>Offer</th>
                          <th>Profile</th>
                          <th>Created</th>
                        </tr>
                      </thead>

                      <tbody>
                        {rankedBids.map((bid) => (
                          <tr key={bid.id}>
                            <td>
                              <span
                                className={`status-pill ${statusClass(
                                  bid.status,
                                )}`}
                              >
                                {labelize(bid.status)}
                              </span>
                            </td>

                            <td>
                              <strong>
                                {person(bid.transporter)}
                              </strong>
                              <small>
                                {bid.transporter?.email ?? "No email"}
                              </small>
                            </td>

                            <td>
                              <strong>
                                {bid.vehicle?.registrationNumber ??
                                  "Unavailable"}
                              </strong>
                              <small>
                                {bid.vehicle?.vehicleType ?? "Unknown"}
                              </small>
                            </td>

                            <td>
                              <strong>{money(bid.amount)}</strong>
                              {bid.id === selectedBidId && (
                                <small>Agreed bid</small>
                              )}
                            </td>

                            <td>
                              <strong>
                                {labelize(
                                  bid.transporter?.transporterTier,
                                )}
                              </strong>
                              <small>
                                {bid.transporter?.rating ?? "—"} rating ·{" "}
                                {bid.transporter?.totalTrips ?? 0} trips
                              </small>
                            </td>

                            <td>{dateTime(bid.createdAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="dashboard">
      <div className="module-header">
        <div>
          <div className="module-kicker">
            TRANSCONET-APEX1 / FLEET MARKETPLACE
          </div>
          <h2>Fleet Marketplace</h2>
          <p>
            Operational command over transport requests, transporter bids,
            vehicle eligibility and marketplace outcomes.
          </p>
        </div>

        <button
          type="button"
          className="refresh-button"
          onClick={() => void loadMarketplace()}
          disabled={loading}
        >
          {loading ? "Refreshing…" : "Refresh Marketplace"}
        </button>
      </div>

      {error && (
        <div className="panel customer-state error-state">
          {error}
        </div>
      )}

      <div className="panel negotiated-marketplace-banner">
        <div>
          <div className="module-kicker">NEGOTIATED FARE WORKFLOW</div>
          <h3>Marketplace fare and commission are separate financial flows</h3>
          <p>
            Customers use the marketplace to receive transporter bids and
            select an agreed transport fare. The agreed fare is paid directly
            to the selected transporter; TransConet does not collect that
            negotiated fare from the customer.
          </p>
        </div>

        <div className="negotiated-marketplace-steps">
          <div>
            <strong>1</strong>
            <span>Customer request</span>
          </div>
          <div>
            <strong>2</strong>
            <span>Transporter bids</span>
          </div>
          <div>
            <strong>3</strong>
            <span>Bid selected</span>
          </div>
          <div>
            <strong>4</strong>
            <span>Fare paid directly</span>
          </div>
          <div>
            <strong>5</strong>
            <span>Commission handled separately</span>
          </div>
        </div>

        <div className="negotiated-marketplace-note">
          <strong>Administration control:</strong> platform commission is
          calculated from the applicable commission rule and is handled
          separately in <strong>Financial Operations → Negotiated Commissions</strong>.
          It must not be treated as transporter Wallet earnings.
        </div>
      </div>

      <div className="stats-grid">
        <StatCard
          label="Open Loads"
          value={loading ? "…" : String(summary?.openRequests ?? 0)}
          detail="Requests currently seeking transport"
        />
        <StatCard
          label="Agreed"
          value={loading ? "…" : String(summary?.agreedRequests ?? 0)}
          detail="Requests with an agreed transporter"
        />
        <StatCard
          label="Pending Bids"
          value={loading ? "…" : String(summary?.pendingBids ?? 0)}
          detail="Active transporter offers"
        />
        <StatCard
          label="Eligible Vehicles"
          value={loading ? "…" : String(summary?.eligibleVehicles ?? 0)}
          detail="Approved and available fleet"
        />
      </div>

      <div className="section-title">
        <h3>Fare Configuration</h3>
        <span>Marketplace pricing rules used for fare calculation</span>
      </div>

      <div className="panel customer-detail-panel">
        {pricingLoading ? (
          <div className="customer-state">
            Loading fare configuration…
          </div>
        ) : !pricingForm ? (
          <div className="empty-activity">
            <strong>Fare configuration unavailable</strong>
            <span>
              No editable pricing configuration is currently available.
            </span>
          </div>
        ) : (
          <>
            <div className="detail-grid">
              <label>
                <span>Base Rate</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={pricingForm.baseRate}
                  onChange={(event) =>
                    setPricingForm({
                      ...pricingForm,
                      baseRate: Number(event.target.value),
                    })
                  }
                />
              </label>

              <label>
                <span>Distance Rate / Km</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={pricingForm.distanceRatePerKm}
                  onChange={(event) =>
                    setPricingForm({
                      ...pricingForm,
                      distanceRatePerKm: Number(event.target.value),
                    })
                  }
                />
              </label>

              <label>
                <span>Weight ≤ 100</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={pricingForm.weightMultipliers.upTo100}
                  onChange={(event) =>
                    setPricingForm({
                      ...pricingForm,
                      weightMultipliers: {
                        ...pricingForm.weightMultipliers,
                        upTo100: Number(event.target.value),
                      },
                    })
                  }
                />
              </label>

              <label>
                <span>Weight ≤ 1,000</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={pricingForm.weightMultipliers.upTo1000}
                  onChange={(event) =>
                    setPricingForm({
                      ...pricingForm,
                      weightMultipliers: {
                        ...pricingForm.weightMultipliers,
                        upTo1000: Number(event.target.value),
                      },
                    })
                  }
                />
              </label>

              <label>
                <span>Weight ≤ 5,000</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={pricingForm.weightMultipliers.upTo5000}
                  onChange={(event) =>
                    setPricingForm({
                      ...pricingForm,
                      weightMultipliers: {
                        ...pricingForm.weightMultipliers,
                        upTo5000: Number(event.target.value),
                      },
                    })
                  }
                />
              </label>

              <label>
                <span>Weight ≤ 10,000</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={pricingForm.weightMultipliers.upTo10000}
                  onChange={(event) =>
                    setPricingForm({
                      ...pricingForm,
                      weightMultipliers: {
                        ...pricingForm.weightMultipliers,
                        upTo10000: Number(event.target.value),
                      },
                    })
                  }
                />
              </label>

              <label>
                <span>Weight &gt; 10,000</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={pricingForm.weightMultipliers.above10000}
                  onChange={(event) =>
                    setPricingForm({
                      ...pricingForm,
                      weightMultipliers: {
                        ...pricingForm.weightMultipliers,
                        above10000: Number(event.target.value),
                      },
                    })
                  }
                />
              </label>
            </div>

            <div className="section-title">
              <h3>Truck Multipliers</h3>
              <span>Vehicle-category pricing multipliers</span>
            </div>

            <div className="detail-grid">
              {Object.entries(pricingForm.truckMultipliers).map(
                ([truckCategory, multiplier]) => (
                  <label key={truckCategory}>
                    <span>{labelize(truckCategory)}</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={multiplier}
                      onChange={(event) =>
                        setPricingForm({
                          ...pricingForm,
                          truckMultipliers: {
                            ...pricingForm.truckMultipliers,
                            [truckCategory]: Number(event.target.value),
                          },
                        })
                      }
                    />
                  </label>
                ),
              )}
            </div>

            {pricingError && (
              <div className="panel customer-state error-state">
                {pricingError}
              </div>
            )}

            {pricingSuccess && (
              <div className="panel customer-state">
                {pricingSuccess}
              </div>
            )}

            <div className="operations-toolbar">
              <span>
                Last updated: {dateTime(pricing?.updatedAt)}
              </span>

              <button
                type="button"
                className="refresh-button"
                disabled={pricingSaving}
                onClick={() => void saveMarketplacePricing()}
              >
                {pricingSaving ? "Saving…" : "Save Fare Configuration"}
              </button>
            </div>
          </>
        )}
      </div>

      <div className="section-title">
        <h3>Commission Rules</h3>
        <span>Editable commission rules used for marketplace settlements</span>
      </div>

      <div className="panel customer-detail-panel">
        <div className="customer-state">
          <strong>Commission Control</strong>
          <span>
            Percentage rules use values such as 5 = 5%. Fixed rules use a
            fixed amount in the selected currency. Only active rules within
            their effective dates are used by the existing commission engine.
          </span>
        </div>

        <div className="detail-grid">
          <label>
            <span>Rule Name</span>
            <input
              value={commissionForm.name}
              onChange={(event) =>
                setCommissionForm({
                  ...commissionForm,
                  name: event.target.value,
                })
              }
              placeholder="Marketplace commission"
            />
          </label>

          <label>
            <span>Type</span>
            <select
              value={commissionForm.type}
              onChange={(event) =>
                setCommissionForm({
                  ...commissionForm,
                  type: event.target.value as "PERCENTAGE" | "FIXED",
                })
              }
            >
              <option value="PERCENTAGE">Percentage</option>
              <option value="FIXED">Fixed</option>
            </select>
          </label>

          <label>
            <span>{commissionForm.type === "PERCENTAGE" ? "Rate %" : "Fixed Amount"}</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={commissionForm.rate}
              onChange={(event) =>
                setCommissionForm({
                  ...commissionForm,
                  rate: Number(event.target.value),
                })
              }
            />
          </label>

          <label>
            <span>Currency</span>
            <input
              value={commissionForm.currency ?? ""}
              onChange={(event) =>
                setCommissionForm({
                  ...commissionForm,
                  currency: event.target.value.toUpperCase(),
                })
              }
              maxLength={10}
            />
          </label>

          <label>
            <span>Transporter Tier</span>
            <select
              value={commissionForm.transporterTier ?? ""}
              onChange={(event) =>
                setCommissionForm({
                  ...commissionForm,
                  transporterTier:
                    event.target.value === ""
                      ? null
                      : (event.target.value as "TIER_1" | "TIER_2"),
                })
              }
            >
              <option value="">All tiers</option>
              <option value="TIER_1">Tier 1</option>
              <option value="TIER_2">Tier 2</option>
            </select>
          </label>

          <label>
            <span>Minimum Fare</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={commissionForm.minAmount ?? ""}
              onChange={(event) =>
                setCommissionForm({
                  ...commissionForm,
                  minAmount:
                    event.target.value === ""
                      ? null
                      : Number(event.target.value),
                })
              }
            />
          </label>

          <label>
            <span>Maximum Fare</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={commissionForm.maxAmount ?? ""}
              onChange={(event) =>
                setCommissionForm({
                  ...commissionForm,
                  maxAmount:
                    event.target.value === ""
                      ? null
                      : Number(event.target.value),
                })
              }
            />
          </label>

          <label>
            <span>Description</span>
            <input
              value={commissionForm.description ?? ""}
              onChange={(event) =>
                setCommissionForm({
                  ...commissionForm,
                  description: event.target.value,
                })
              }
              placeholder="Optional rule description"
            />
          </label>
        </div>

        {commissionError && (
          <div className="panel customer-state error-state">
            {commissionError}
          </div>
        )}

        {commissionSuccess && (
          <div className="panel customer-state">
            {commissionSuccess}
          </div>
        )}

        <div className="operations-toolbar">
          <span>
            {commissionEditingId
              ? "Editing existing commission rule"
              : "Create a new commission rule"}
          </span>
          <div className="operations-controls">
            {commissionEditingId && (
              <button
                type="button"
                className="refresh-button"
                onClick={resetCommissionForm}
                disabled={commissionSaving}
              >
                Cancel Edit
              </button>
            )}
            <button
              type="button"
              className="refresh-button"
              onClick={() => void saveCommissionRule()}
              disabled={commissionSaving || !commissionForm.name.trim()}
            >
              {commissionSaving
                ? "Saving…"
                : commissionEditingId
                  ? "Update Commission Rule"
                  : "Create Commission Rule"}
            </button>
          </div>
        </div>

        <div className="section-title">
          <h3>Configured Rules</h3>
          <span>Activate, deactivate, or edit existing rules</span>
        </div>

        {commissionLoading ? (
          <div className="customer-state">Loading commission rules…</div>
        ) : commissionRules.length === 0 ? (
          <div className="empty-activity">
            <strong>No commission rules configured</strong>
            <span>Create a rule above to control marketplace commission.</span>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Rate</th>
                  <th>Tier</th>
                  <th>Fare Range</th>
                  <th>Effective</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {commissionRules.map((rule) => (
                  <tr key={rule.id}>
                    <td>{rule.name}</td>
                    <td>{labelize(rule.type)}</td>
                    <td>
                      {rule.type === "PERCENTAGE"
                        ? `${Number(rule.rate).toFixed(2)}%`
                        : money(rule.rate)}
                    </td>
                    <td>{labelize(rule.transporterTier)}</td>
                    <td>
                      {money(rule.minAmount)} — {money(rule.maxAmount)}
                    </td>
                    <td>
                      {dateTime(rule.effectiveFrom)}
                      {rule.effectiveTo
                        ? ` — ${dateTime(rule.effectiveTo)}`
                        : " — No expiry"}
                    </td>
                    <td>
                      <span className={`status-badge ${statusClass(rule.status)}`}>
                        {labelize(rule.status)}
                      </span>
                    </td>
                    <td>
                      <div className="operations-controls">
                        <button
                          type="button"
                          className="refresh-button"
                          onClick={() => editCommissionRule(rule)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="refresh-button"
                          onClick={() => void toggleCommissionRule(rule)}
                        >
                          {rule.status === "ACTIVE" ? "Deactivate" : "Activate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="section-title">
        <h3>Marketplace Requests</h3>
        <span>Customer loads entering the fleet marketplace</span>
      </div>

      <div className="panel">
        <div className="operations-toolbar">
          <div>
            <strong>Request Directory</strong>
            <span>{requests.length} records returned</span>
          </div>

          <div className="operations-controls">
            <label>
              <span>Search</span>
              <input
                value={requestSearch}
                onChange={(event) => {
                  setRequestPage(1);
                  setRequestSearch(event.target.value);
                }}
                placeholder="Location, cargo, customer…"
              />
            </label>

            <label>
              <span>Status</span>
              <select
                value={requestStatus}
                onChange={(event) => {
                  setRequestPage(1);
                  setRequestStatus(event.target.value);
                }}
              >
                {requestStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status ? labelize(status) : "All statuses"}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="operations-table-wrap">
          <table className="operations-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Route</th>
                <th>Customer</th>
                <th>Load</th>
                <th>Estimated / Agreed Fare</th>
                <th>Bids</th>
                <th>Created</th>
              </tr>
            </thead>

            <tbody>
              {requests.map((request) => (
                <tr
                  key={request.id}
                  className="selected-row"
                  onClick={() => void openRequest(request.id)}
                >
                  <td>
                    <span
                      className={`status-pill ${statusClass(
                        request.status,
                      )}`}
                    >
                      {labelize(request.status)}
                    </span>
                  </td>

                  <td>
                    <strong>{request.pickupLocation}</strong>
                    <small>→ {request.destination}</small>
                  </td>

                  <td>
                    <strong>{person(request.customer)}</strong>
                    <small>
                      {request.customer?.email ?? "No email"}
                    </small>
                  </td>

                  <td>
                    <strong>
                      {labelize(request.truckCategory)}
                    </strong>
                    <small>
                      {labelize(request.cargoCategory)}
                    </small>
                  </td>

                  <td>
                    <strong>{money(request.estimatedFare)}</strong>
                    <small>
                      {request.status === "AGREED"
                        ? "Negotiated outcome"
                        : "Marketplace estimate"}
                    </small>
                  </td>
                  <td>{request.bidCount}</td>
                  <td>{dateTime(request.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {!loading && requests.length === 0 && (
            <div className="empty-activity">
              <strong>No marketplace requests</strong>
              <span>
                No requests matched the current marketplace filters.
              </span>
            </div>
          )}
        </div>

        <Pagination
          page={requestPage}
          pages={requestPages}
          onPrevious={() => setRequestPage((page) => Math.max(1, page - 1))}
          onNext={() =>
            setRequestPage((page) => Math.min(requestPages, page + 1))
          }
        />
      </div>

      <div className="section-title">
        <h3>Bid Activity</h3>
        <span>
          Transporter offers; a selected bid establishes the negotiated fare
        </span>
      </div>

      <div className="panel">
        <div className="operations-toolbar">
          <div>
            <strong>Bid Directory</strong>
            <span>{bids.length} records returned</span>
          </div>

          <div className="operations-controls">
            <label>
              <span>Search</span>
              <input
                value={bidSearch}
                onChange={(event) => {
                  setBidPage(1);
                  setBidSearch(event.target.value);
                }}
                placeholder="Transporter, vehicle, bid ID…"
              />
            </label>

            <label>
              <span>Status</span>
              <select
                value={bidStatus}
                onChange={(event) => {
                  setBidPage(1);
                  setBidStatus(event.target.value);
                }}
              >
                {bidStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status ? labelize(status) : "All bid statuses"}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="operations-table-wrap">
          <table className="operations-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Transporter</th>
                <th>Vehicle</th>
                <th>Offer</th>
                <th>Request</th>
                <th>Created</th>
              </tr>
            </thead>

            <tbody>
              {bids.map((bid) => (
                <tr key={bid.id}>
                  <td>
                    <span
                      className={`status-pill ${statusClass(bid.status)}`}
                    >
                      {labelize(bid.status)}
                    </span>
                  </td>

                  <td>
                    <strong>{person(bid.transporter)}</strong>
                    <small>
                      {bid.transporter?.email ?? "No email"}
                    </small>
                  </td>

                  <td>
                    <strong>
                      {bid.vehicle?.registrationNumber ??
                        "Unavailable"}
                    </strong>
                    <small>
                      {bid.vehicle?.vehicleType ?? "Unknown"}
                    </small>
                  </td>

                  <td>
                    <strong>{money(bid.amount)}</strong>
                    <small>
                      {bid.transporter?.totalTrips ?? 0} trips
                    </small>
                  </td>

                  <td>{bid.requestId}</td>
                  <td>{dateTime(bid.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {!loading && bids.length === 0 && (
            <div className="empty-activity">
              <strong>No bid activity</strong>
              <span>
                No bids matched the current marketplace filters.
              </span>
            </div>
          )}
        </div>

        <Pagination
          page={bidPage}
          pages={bidPages}
          onPrevious={() => setBidPage((page) => Math.max(1, page - 1))}
          onNext={() =>
            setBidPage((page) => Math.min(bidPages, page + 1))
          }
        />
      </div>
    </section>
  );
}

function Pagination({
  page,
  pages,
  onPrevious,
  onNext,
}: {
  page: number;
  pages: number;
  onPrevious: () => void;
  onNext: () => void;
}) {
  if (pages <= 1) return null;

  return (
    <div className="operations-toolbar">
      <span>
        Page {page} of {pages}
      </span>

      <div className="operations-controls">
        <button
          type="button"
          className="refresh-button"
          disabled={page <= 1}
          onClick={onPrevious}
        >
          Previous
        </button>

        <button
          type="button"
          className="refresh-button"
          disabled={page >= pages}
          onClick={onNext}
        >
          Next
        </button>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
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
