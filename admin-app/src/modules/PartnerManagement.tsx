import { useEffect, useMemo, useState } from "react";
import {
  getAdminPartner,
  getAdminPartners,
  updateAdminPartner,
  type AdminPartner,
} from "../api/partners";

function partnerName(partner: AdminPartner) {
  return (
    [partner.user.firstName, partner.user.lastName]
      .filter(Boolean)
      .join(" ") ||
    partner.user.email
  );
}

function formatDate(value: string | null) {
  if (!value) return "Never";

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function PartnerManagement() {
  const [partners, setPartners] = useState<AdminPartner[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [selected, setSelected] = useState<AdminPartner | null>(null);
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadPartners() {
    try {
      setLoading(true);
      setError("");

      const data = await getAdminPartners();
      setPartners(data);

      if (selectedId) {
        const current = data.find((partner) => partner.userId === selectedId);
        if (current) setSelected(current);
      }
    } catch {
      setError("Unable to load Partner Management.");
    } finally {
      setLoading(false);
    }
  }

  async function selectPartner(userId: string) {
    try {
      setSelectedId(userId);
      setDetailLoading(true);
      setError("");

      const data = await getAdminPartner(userId);
      setSelected(data);
    } catch {
      setError("Unable to load partner details.");
    } finally {
      setDetailLoading(false);
    }
  }

  async function changeTier(tier: "TIER_1" | "TIER_2") {
    if (!selected) return;

    try {
      setActionLoading(true);
      setError("");

      const updated = await updateAdminPartner(selected.userId, {
        tier,
      });

      setSelected((current) =>
        current ? { ...current, ...updated } : updated,
      );

      setPartners((current) =>
        current.map((partner) =>
          partner.userId === updated.userId ? updated : partner,
        ),
      );
    } catch {
      setError("Unable to update partner tier.");
    } finally {
      setActionLoading(false);
    }
  }

  async function toggleTier2Approval() {
    if (!selected) return;

    try {
      setActionLoading(true);
      setError("");

      const updated = await updateAdminPartner(selected.userId, {
        tier2Approved: !selected.tier2Approved,
      });

      setSelected((current) =>
        current ? { ...current, ...updated } : updated,
      );

      setPartners((current) =>
        current.map((partner) =>
          partner.userId === updated.userId ? updated : partner,
        ),
      );
    } catch {
      setError("Unable to update Tier 2 approval.");
    } finally {
      setActionLoading(false);
    }
  }

  useEffect(() => {
    void loadPartners();
  }, []);

  const filteredPartners = useMemo(() => {
    const query = search.trim().toLowerCase();

    return partners.filter((partner) => {
      const name = partnerName(partner).toLowerCase();

      const matchesSearch =
        !query ||
        name.includes(query) ||
        partner.user.email.toLowerCase().includes(query) ||
        (partner.user.phone ?? "").toLowerCase().includes(query);

      const matchesTier =
        !tierFilter ||
        partner.user.transporterTier === tierFilter;

      return matchesSearch && matchesTier;
    });
  }, [partners, search, tierFilter]);

  return (
    <section className="module-workspace">
      <div className="module-header">
        <span className="module-kicker">TRANSCONET-APEX1 GOVERNANCE</span>
        <h2>Partner Management</h2>
        <p>
          Administer transporter partners, operational tiers, Tier 2
          approval, vehicles, and partner performance.
        </p>
      </div>

      {error && (
        <div className="module-card module-error">
          <strong>Partner Management unavailable</strong>
          <p>{error}</p>
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card">
          <span>Total Partners</span>
          <strong>{loading ? "…" : partners.length}</strong>
          <small>Registered transporter partners</small>
        </div>

        <div className="stat-card">
          <span>Tier 2 Partners</span>
          <strong>
            {loading
              ? "…"
              : partners.filter(
                  (partner) => partner.user.transporterTier === "TIER_2",
                ).length}
          </strong>
          <small>Partners operating at Tier 2</small>
        </div>

        <div className="stat-card">
          <span>Tier 2 Approved</span>
          <strong>
            {loading
              ? "…"
              : partners.filter((partner) => partner.tier2Approved).length}
          </strong>
          <small>Administratively approved</small>
        </div>

        <div className="stat-card">
          <span>Available Vehicles</span>
          <strong>
            {loading
              ? "…"
              : partners.reduce(
                  (total, partner) =>
                    total + (partner.statistics.availableVehicleCount ?? 0),
                  0,
                )}
          </strong>
          <small>Currently available fleet capacity</small>
        </div>
      </div>

      <div className="module-card">
        <div className="module-toolbar">
          <div>
            <strong>Partner directory</strong>
            <span>
              Live partner records supplied by the administration API.
            </span>
          </div>

          <div className="module-controls">
            <label>
              <span>Search</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Name, email or phone"
              />
            </label>

            <label>
              <span>Tier</span>
              <select
                value={tierFilter}
                onChange={(event) => setTierFilter(event.target.value)}
              >
                <option value="">All tiers</option>
                <option value="TIER_1">Tier 1</option>
                <option value="TIER_2">Tier 2</option>
              </select>
            </label>

            <button
              type="button"
              className="refresh-button"
              disabled={loading}
              onClick={() => void loadPartners()}
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>
      </div>

      <div className="partner-management-layout">
        <div className="module-card">
          <div className="panel-header">
            <div>
              <h2>Partners</h2>
              <p>{filteredPartners.length} matching partner records</p>
            </div>
          </div>

          {loading ? (
            <div className="module-empty">
              <strong>Loading partners…</strong>
            </div>
          ) : filteredPartners.length === 0 ? (
            <div className="module-empty">
              <strong>No partners found</strong>
              <span>Try changing the current filters.</span>
            </div>
          ) : (
            <div className="partner-list">
              {filteredPartners.map((partner) => (
                <button
                  key={partner.userId}
                  type="button"
                  className={`partner-row ${
                    selectedId === partner.userId ? "active" : ""
                  }`}
                  onClick={() => void selectPartner(partner.userId)}
                >
                  <div>
                    <strong>{partnerName(partner)}</strong>
                    <span>{partner.user.email}</span>
                  </div>

                  <div>
                    <strong>
                      {partner.user.transporterTier ?? "UNASSIGNED"}
                    </strong>
                    <span>
                      {partner.statistics.vehicleCount} vehicles
                    </span>
                  </div>

                  <div>
                    <span
                      className={`status-badge status-${partner.user.status.toLowerCase()}`}
                    >
                      {partner.user.status}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="module-card partner-detail">
          {!selected ? (
            <div className="detail-empty">
              <strong>Select a partner</strong>
              <span>
                Partner details and administrative controls will appear here.
              </span>
            </div>
          ) : detailLoading ? (
            <div className="detail-loading">
              Loading partner details…
            </div>
          ) : (
            <>
              <div className="partner-detail-header">
                <div>
                  <span className="module-kicker">PARTNER PROFILE</span>
                  <h2>{partnerName(selected)}</h2>
                  <p>{selected.user.email}</p>
                </div>

                <span
                  className={`status-badge status-${selected.user.status.toLowerCase()}`}
                >
                  {selected.user.status}
                </span>
              </div>

              <div className="detail-grid">
                <div>
                  <span>Tier</span>
                  <strong>
                    {selected.user.transporterTier ?? "UNASSIGNED"}
                  </strong>
                </div>

                <div>
                  <span>Tier 2 Approval</span>
                  <strong>
                    {selected.tier2Approved ? "APPROVED" : "NOT APPROVED"}
                  </strong>
                </div>

                <div>
                  <span>Vehicles</span>
                  <strong>{selected.statistics.vehicleCount}</strong>
                </div>

                <div>
                  <span>Bookings</span>
                  <strong>
                    {selected.statistics.bookingCount ?? "—"}
                  </strong>
                </div>

                <div>
                  <span>Completed Bookings</span>
                  <strong>
                    {selected.statistics.completedBookingCount ?? "—"}
                  </strong>
                </div>

                <div>
                  <span>Last Login</span>
                  <strong>{formatDate(selected.user.lastLoginAt)}</strong>
                </div>
              </div>

              <div className="partner-actions">
                <strong>Administrative controls</strong>

                <div>
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => void changeTier("TIER_1")}
                  >
                    Set Tier 1
                  </button>

                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => void changeTier("TIER_2")}
                  >
                    Set Tier 2
                  </button>

                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => void toggleTier2Approval()}
                  >
                    {selected.tier2Approved
                      ? "Revoke Tier 2 Approval"
                      : "Approve Tier 2"}
                  </button>
                </div>
              </div>

              <div className="partner-vehicles">
                <div className="panel-header">
                  <div>
                    <h2>Partner fleet</h2>
                    <p>{selected.user.vehicles.length} vehicles</p>
                  </div>
                </div>

                {selected.user.vehicles.length === 0 ? (
                  <div className="module-empty">
                    <span>No vehicles registered.</span>
                  </div>
                ) : (
                  <div className="partner-vehicle-list">
                    {selected.user.vehicles.map((vehicle) => (
                      <div className="partner-vehicle-row" key={vehicle.id}>
                        <div>
                          <strong>{vehicle.registrationNumber}</strong>
                          <span>
                            {vehicle.vehicleType} · {vehicle.vehicleClass}
                          </span>
                        </div>

                        <span>{vehicle.verificationStatus}</span>
                        <span>{vehicle.availabilityStatus}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

export default PartnerManagement;
