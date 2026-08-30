import { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";
import Administrators from "./modules/Administrators";
import Customers from "./modules/Customers";
import Transporters from "./modules/Transporters";
import RolePermissions from "./modules/RolePermissions";
import FinancialOperations from "./modules/FinancialOperations";
import MarketingCenter from "./modules/MarketingCenter";
import BookingsShipments from "./modules/BookingsShipments";
import Marketplace from "./modules/Marketplace";
import Subscriptions from "./modules/Subscriptions";
import SupportCare from "./modules/SupportCare";
import Fleet from "./modules/Fleet";
import SecurityCenter from "./modules/SecurityCenter";
import NotificationCenter from "./modules/NotificationCenter";
import PartnerManagement from "./modules/PartnerManagement";
import ReportCenter from "./modules/ReportCenter";
import ErrorCenter from "./modules/ErrorCenter";
import FeatureManagement from "./modules/FeatureManagement";
import RiskFraud from "./modules/RiskFraud";
import ContentManagement from "./modules/ContentManagement";
import ApiManagement from "./modules/ApiManagement";
import AIAutomation from "./modules/AIAutomation";
import ActivityTimeline from "./modules/ActivityTimeline";
import BackupRecovery from "./modules/BackupRecovery";
import DatabaseHealth from "./modules/DatabaseHealth";
import Settings from "./modules/Settings";
import VerificationCenter from "./modules/VerificationCenter";
import { useAuthStore } from "./auth/auth.store";
import { getPlatformOverview, type PlatformOverview } from "./api/admin";
import {
  getLiveTripSummary,
  getLiveTrips,
  getLiveTrip,
  getLiveTripTracking,
  type LiveTrip,
  type LiveTripSummary,
  type TrackingPoint,
} from "./api/live-trips";
import { subscribeAdminRealtime, type AdminRealtimeEvent, type AdminVehicleLocation } from "./realtime/admin-realtime";

type NavItem = {
  label: string;
  section?: string;
  description: string;
};

const primaryNav: NavItem[] = [
  {
    label: "Command Center",
    description: "Platform-wide operational overview",
  },
  {
    label: "Live Operations",
    section: "OPERATIONS",
    description: "Monitor active transport operations",
  },
  {
    label: "Bookings & Shipments",
    description: "Manage bookings and shipment lifecycles",
  },
  {
    label: "Customers",
    description: "Customer accounts and activity",
  },
  {
    label: "Transporters",
    description: "Transporter accounts and performance",
  },
  {
    label: "Fleet",
    description: "Vehicles and fleet operations",
  },
  {
    label: "Marketplace",
    section: "MARKETPLACE",
    description: "Transport requests and marketplace activity",
  },
  {
    label: "Marketing Center",
    section: "MARKETPLACE",
    description: "Create, schedule, publish, and manage customer and transporter advertisements",
  },
  {
    label: "Bidding",
    description: "Monitor marketplace bidding",
  },
  {
    label: "Payments",
    section: "FINANCIAL",
    description: "Payment operations and transactions",
  },
  {
    label: "Wallets",
    description: "Wallet and withdrawal operations",
  },
  {
    label: "Subscriptions",
    description: "Subscription administration",
  },
  {
    label: "Verification",
    section: "GOVERNANCE",
    description: "Verification and compliance",
  },
  {
    label: "Content Management",
    description: "Govern platform content and controlled publishing",
  },
  {
    label: "Support",
    description: "Customer and transporter support",
  },
  {
    label: "Disputes",
    description: "Dispute management and resolution",
  },
  {
    label: "Risk & Fraud",
    description: "Risk signals and suspicious activity",
  },
  {
    label: "AI Automation",
    section: "INTELLIGENCE",
    description: "Rule-based operational intelligence and automation",
  },
  {
    label: "Error Center",
    section: "INTELLIGENCE",
    description: "Application errors, operational failures, and system events",
  },
  {
    label: "Reports",
    section: "INTELLIGENCE",
    description: "Operational and platform intelligence",
  },
  {
    label: "Notifications",
    description: "Platform notification operations",
  },
  {
    label: "Messages",
    description: "Platform communication",
  },
  {
    label: "Security",
    section: "SYSTEM",
    description: "Security events and controls",
  },
  {
    label: "Feature Management",
    description: "Control controlled feature availability and rollout",
  },
  {
    label: "Administrators",
    description: "Manage administration accounts and administrator access",
  },
  {
    label: "Roles & Permissions",
    description: "Govern administrator roles and module permissions",
  },
  {
    label: "Audit Logs",
    description: "Administrative activity history",
  },
  {
    label: "Activity Timeline",
    section: "OPERATIONS",
    description: "Platform-wide operational and administrative event stream",
  },
  {
    label: "API Management",
    section: "SYSTEM",
    description: "Monitor API health, performance, and backend resource activity",
  },
  {
    label: "Backup & Recovery",
    description: "Monitor backup protection and recovery readiness",
  },
  {
    label: "Database Health",
    description: "Monitor PostgreSQL connectivity, response performance, and platform records",
  },
  {
    label: "Settings",
    description: "Platform configuration",
  },
];

function getInitial(label: string) {
  return label
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function App() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  const [active, setActive] = useState("Command Center");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [overview, setOverview] = useState<PlatformOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState("");

  const activeItem = useMemo(
    () =>
      primaryNav.find((item) => item.label === active) ??
      primaryNav[0],
    [active],
  );

  const administratorName =
    [user?.firstName, user?.lastName]
      .filter(Boolean)
      .join(" ") || "Administrator";

  const administratorType =
    user?.adminProfile?.administratorType ??
    "Administrator";

  const isSuperAdministrator =
    Boolean(
      user?.adminProfile?.isSuperAdministrator,
    );

  useEffect(() => {
    let mounted = true;

    async function loadOverview() {
      try {
        setOverviewLoading(true);
        setOverviewError("");

        const data = await getPlatformOverview();

        if (mounted) {
          setOverview(data);
        }
      } catch {
        if (mounted) {
          setOverviewError("Unable to load live platform overview.");
        }
      } finally {
        if (mounted) {
          setOverviewLoading(false);
        }
      }
    }

    void loadOverview();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="admin-shell">
      <aside
        className={`sidebar ${
          sidebarOpen ? "sidebar-open" : "sidebar-collapsed"
        }`}
      >
        <div className="brand">
          <div className="brand-mark">A</div>

          {sidebarOpen && (
            <div className="brand-copy">
              <strong>TransConet-Apex1</strong>
              <span>Administration Management</span>
            </div>
          )}
        </div>

        <nav className="navigation">
          {primaryNav.map((item) => (
            <div key={item.label}>
              {item.section && sidebarOpen && (
                <div className="nav-section">
                  {item.section}
                </div>
              )}

              <button
                type="button"
                className={`nav-item ${
                  active === item.label ? "active" : ""
                }`}
                title={
                  sidebarOpen
                    ? undefined
                    : item.label
                }
                onClick={() => setActive(item.label)}
              >
                <span className="nav-icon">
                  {getInitial(item.label)}
                </span>

                {sidebarOpen && (
                  <span className="nav-label">
                    {item.label}
                  </span>
                )}
              </button>
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <span className="status-dot" />

          {sidebarOpen && (
            <span>Administration API connected</span>
          )}
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="menu-button"
              onClick={() =>
                setSidebarOpen((value) => !value)
              }
              aria-label="Toggle navigation"
            >
              ☰
            </button>

            <div>
              <div className="breadcrumb">
                TransConet-Apex1 / Administration /{" "}
                {active}
              </div>

              <h1>{active}</h1>

              <p className="page-description">
                {activeItem.description}
              </p>
            </div>
          </div>

          <div className="topbar-actions">
            <button
              type="button"
              className="icon-button"
              aria-label="Search"
            >
              ⌕
            </button>

            <button
              type="button"
              className="icon-button"
              aria-label="Notifications"
            >
              ◉
            </button>

            <div className="admin-profile">
              <div className="avatar">
                {getInitial(administratorName)}
              </div>

              <div className="admin-profile-copy">
                <strong>{administratorName}</strong>

                <span>
                  {isSuperAdministrator
                    ? "Super Administrator"
                    : administratorType}
                </span>
              </div>

              <button
                type="button"
                className="logout-button"
                onClick={logout}
              >
                Logout
              </button>
            </div>
          </div>
        </header>

        {active === "Command Center" ? (
          <CommandCenter
            administratorName={administratorName}
            overview={overview}
            overviewLoading={overviewLoading}
            overviewError={overviewError}
          />
        ) : active === "Live Operations" ? (
          <LiveOperations />
        ) : active === "Bookings & Shipments" ? (
          <BookingsShipments />
        ) : active === "Marketing Center" || active === "Marketing" ? (
          <MarketingCenter />
        ) : active === "Customers" ? (
          <Customers />
        ) : active === "Transporters" ? (
          <Transporters />
        ) : active === "Fleet" ? (
          <Fleet />
        ) : active === "Marketplace" ? (
          <Marketplace />
        ) : active === "Bidding" ? (
          <Marketplace />
        ) : active === "Feature Management" ? (
          <FeatureManagement />
        ) : active === "Security" ? (
          <SecurityCenter />
        ) : active === "Administrators" ? (
          <Administrators />
        ) : active === "Roles & Permissions" ? (
          <RolePermissions />
        ) : active === "Payments" || active === "Wallets" ? (
          <FinancialOperations />
        ) : active === "Subscriptions" ? (
          <Subscriptions />
        ) : active === "Verification" ? (
          <VerificationCenter />
        ) : active === "Risk & Fraud" ? (
          <RiskFraud />
        ) : active === "Error Center" ? (
          <ErrorCenter />
        ) : active === "Reports" ? (
          <ReportCenter />
        ) : active === "Partner Management" ? (
          <PartnerManagement />
        ) : active === "Notifications" ? (
          <NotificationCenter />
        ) : active === "Content Management" ? (
          <ContentManagement />
        ) : active === "Activity Timeline" ? (
          <ActivityTimeline />
        ) : active === "AI Automation" ? (
          <AIAutomation />
        ) : active === "API Management" ? (
          <ApiManagement />
        ) : active === "Backup & Recovery" ? (
          <BackupRecovery />
        ) : active === "Database Health" ? (
          <DatabaseHealth />
        ) : active === "Settings" ? (
          <Settings />
        ) : active === "Support" ? (
          <SupportCare />
        ) : (
          <ModuleWorkspace
            title={active}
            description={activeItem.description}
          />
        )}
      </main>
    </div>
  );
}

function CommandCenter({
  administratorName,
  overview,
  overviewLoading,
  overviewError,
}: {
  administratorName: string;
  overview: PlatformOverview | null;
  overviewLoading: boolean;
  overviewError: string;
}) {
  return (
    <div className="dashboard">
      <section className="welcome-panel">
        <div>
          <span className="eyebrow">
            TRANSCONET-APEX1 COMMAND CENTER
          </span>

          <h2>
            Welcome back, {administratorName}.
          </h2>

          <p>
            This is the central administration workspace
            for monitoring and governing the TransConet-Apex1
            transportation and logistics ecosystem.
          </p>
        </div>

        <div className="command-status">
          <span className="status-dot" />
          <span>Platform monitoring active</span>
        </div>
      </section>

      <section className="stats-grid">
        <StatCard
          label="Customers"
          value={overviewLoading ? "…" : String(overview?.customers ?? "—")}
          detail={overviewError || "Registered customer accounts"}
        />

        <StatCard
          label="Transporters"
          value={overviewLoading ? "…" : String(overview?.transporters ?? "—")}
          detail={overviewError || "Registered transporter accounts"}
        />

        <StatCard
          label="Active Operations"
          value={overviewLoading ? "…" : String(overview?.activeTrips ?? "—")}
          detail={overviewError || "Currently active transport operations"}
        />

        <StatCard
          label="Marketplace Activity"
          value={overviewLoading ? "…" : String(
            (overview?.pendingBookings ?? 0) + (overview?.pendingPayments ?? 0),
          )}
          detail={overviewError || "Pending marketplace and payment activity"}
        />
      </section>

      <section className="dashboard-grid">
        <div className="panel operations-panel">
          <div className="panel-header">
            <div>
              <h2>Live Operations</h2>
              <p>
                Real-time transport activity will appear
                here.
              </p>
            </div>

            <span className="live-badge">
              <span className="status-dot" />
              LIVE
            </span>
          </div>

          <div className="operations-canvas">
            <div className="operations-grid" />

            <div className="operations-message">
              <div className="operations-symbol">
                A
              </div>

              <strong>
                Operational intelligence workspace
              </strong>

              <span>
                Live trips, shipment movement and authorized
                vehicle visibility will connect here.
              </span>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Platform Health</h2>
              <p>Administration infrastructure status</p>
            </div>
          </div>

          <div className="health-list">
            <HealthRow label="Backend API" />
            <HealthRow label="Database" />
            <HealthRow label="Realtime" />
            <HealthRow label="Payments" />
            <HealthRow label="Notifications" />
          </div>
        </div>
      </section>

      <section className="panel activity-panel">
        <div className="panel-header">
          <div>
            <h2>Recent Activity</h2>
            <p>
              Administrative and platform events
            </p>
          </div>

          <button
            type="button"
            className="text-button"
          >
            View audit activity
          </button>
        </div>

        <div className="empty-activity">
          <div className="empty-icon">◷</div>

          <strong>
            Waiting for authorized platform events
          </strong>

          <span>
            Realtime activity will populate this workspace
            once the administration event stream is connected.
          </span>
        </div>
      </section>
    </div>
  );
}

function LiveOperations() {
  const [summary, setSummary] = useState<LiveTripSummary | null>(null);
  const [trips, setTrips] = useState<LiveTrip[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<LiveTrip | null>(null);
  const [tracking, setTracking] = useState<TrackingPoint[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [error, setError] = useState("");
  const [detailError, setDetailError] = useState("");
  const [realtimeConnected, setRealtimeConnected] = useState(false);

  const loadOperations = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const filters = statusFilter ? { status: statusFilter } : undefined;

      const [summaryData, tripData] = await Promise.all([
        getLiveTripSummary(),
        getLiveTrips(filters),
      ]);

      setSummary(summaryData);
      setTrips(tripData);

      if (
        selectedTrip &&
        !tripData.some((trip) => trip.id === selectedTrip.id)
      ) {
        setSelectedTrip(null);
        setTracking([]);
      }
    } catch {
      setError("Unable to load live operations.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, selectedTrip]);

  async function selectTripById(tripId: string) {
    try {
      const [detail, trackingData] = await Promise.all([
        getLiveTrip(tripId),
        getLiveTripTracking(tripId),
      ]);

      setSelectedTrip(detail);
      setTracking(trackingData.points);
    } catch {
      setDetailError("Unable to refresh the selected trip.");
    }
  }

  async function selectTrip(trip: LiveTrip) {
    try {
      setSelectedTrip(trip);
      setDetailLoading(true);
      setTrackingLoading(true);
      setDetailError("");

      const [detail, trackingData] = await Promise.all([
        getLiveTrip(trip.id),
        getLiveTripTracking(trip.id),
      ]);

      setSelectedTrip(detail);
      setTracking(trackingData.points);
    } catch {
      setDetailError("Unable to load the selected trip.");
      setTracking([]);
    } finally {
      setDetailLoading(false);
      setTrackingLoading(false);
    }
  }

  useEffect(() => {
    void loadOperations();
  }, [loadOperations]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let active = true;

    void subscribeAdminRealtime("LIVE_TRIPS", {
      onConnectionChange: (connected) => {
        if (active) setRealtimeConnected(connected);
      },

      onAccessDenied: (message) => {
        if (active) setError(message);
      },

      onModuleEvent: (event: AdminRealtimeEvent) => {
        if (!active) return;

        const terminalStatuses = new Set([
          "CANCELLED",
          "COMPLETED",
          "DELIVERY_CONFIRMED",
        ]);

        if (
          event.entityType === "BOOKING" &&
          event.bookingId
        ) {
          const payload =
            event.data && typeof event.data === "object"
              ? event.data as Record<string, unknown>
              : {};

          const nextStatus =
            typeof payload.status === "string"
              ? payload.status
              : event.eventType;

          if (terminalStatuses.has(nextStatus)) {
            setTrips((current) =>
              current.filter((trip) => trip.id !== event.bookingId),
            );

            setSelectedTrip((current) =>
              current?.id === event.bookingId ? null : current,
            );

            setTracking((current) =>
              selectedTrip?.id === event.bookingId ? [] : current,
            );

            return;
          }

          setTrips((current) =>
            current.map((trip) =>
              trip.id === event.bookingId
                ? {
                    ...trip,
                    status: nextStatus,
                    transporter: trip.transporter,
                    vehicle: trip.vehicle,
                  }
                : trip,
            ),
          );

          if (selectedTrip?.id === event.bookingId) {
            void selectTripById(event.bookingId);
          }
        }

        void loadOperations();
      },

      onVehicleLocation: (location: AdminVehicleLocation) => {
        if (!active || !location.vehicleId) return;

        setTrips((current) =>
          current.map((trip) =>
            trip.vehicle?.id === location.vehicleId
              ? {
                  ...trip,
                  vehicle: trip.vehicle
                    ? {
                        ...trip.vehicle,
                        currentLatitude: location.latitude,
                        currentLongitude: location.longitude,
                      }
                    : trip.vehicle,
                }
              : trip,
          ),
        );

        if (
          selectedTrip?.id === location.bookingId &&
          location.bookingId
        ) {
          setTracking((current) => [
            ...current,
            {
              id:
                location.id ??
                `${location.vehicleId}-${location.recordedAt ?? Date.now()}`,
              bookingId: location.bookingId!,
              vehicleId: location.vehicleId!,
              latitude: location.latitude,
              longitude: location.longitude,
              speed: location.speed ?? null,
              heading: location.heading ?? null,
              accuracy: location.accuracy ?? null,
              source: "REALTIME",
              recordedAt:
                location.recordedAt ?? new Date().toISOString(),
            },
          ]);
        }
      },
    })
      .then((cleanup) => {
        if (active) {
          unsubscribe = cleanup;
        } else {
          cleanup();
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setRealtimeConnected(false);
          setError(
            error instanceof Error
              ? error.message
              : "Unable to connect to live operations realtime.",
          );
        }
      });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [loadOperations, selectedTrip?.id]);

  return (
    <section className="module-workspace live-operations-workspace">
      <div className="module-header">
        <span className="module-kicker">
          TRANSCONET-APEX1 OPERATIONS
        </span>
        <h2>Live Operations</h2>
        <p>
          Monitor authorized active transport operations directly from
          the TransConet-Apex1 backend.
        </p>
      </div>

      {error && (
        <div className="module-card module-error">
          <strong>Operations unavailable</strong>
          <p>{error}</p>
        </div>
      )}

      <div className="stats-grid">
        <StatCard
          label="Live Trips"
          value={loading ? "…" : String(summary?.total ?? 0)}
          detail="Currently active trips"
        />
        <StatCard
          label="Assigned"
          value={loading ? "…" : String(summary?.assigned ?? 0)}
          detail="Assigned operations"
        />
        <StatCard
          label="Arriving / Arrived"
          value={
            loading
              ? "…"
              : String(
                  (summary?.driverArriving ?? 0) +
                    (summary?.arrived ?? 0),
                )
          }
          detail="Arrival activity"
        />
        <StatCard
          label="In Transit"
          value={loading ? "…" : String(summary?.inTransit ?? 0)}
          detail="Trips currently moving"
        />
      </div>

      <div className="operations-toolbar">
        <div>
          <strong>Active transport operations</strong>
          <span>
            {trips.length} operation{trips.length === 1 ? "" : "s"} returned
          </span>
        </div>

        <div className="operations-controls">
          <label>
            <span>Status</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="">All active statuses</option>
              <option value="ASSIGNED">Assigned</option>
              <option value="ACCEPTED">Accepted</option>
              <option value="DRIVER_ARRIVING">Driver arriving</option>
              <option value="ARRIVED">Arrived</option>
              <option value="IN_TRANSIT">In transit</option>
            </select>
          </label>

          <button
            type="button"
            className="refresh-button"
            onClick={() => void loadOperations()}
            disabled={loading}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      <div className="live-operations-grid">
        <div className="operations-table-panel">
          <div className="panel-header">
            <div>
              <h2>Active Trips</h2>
              <p>Backend-authorized live operation records</p>
            </div>
            <span className="live-badge">
              <span className="status-dot" />
              {realtimeConnected ? "LIVE" : "SYNCING"}
            </span>
          </div>

          <div className="operations-table-wrap">
            <table className="operations-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Vehicle</th>
                  <th>Customer</th>
                  <th>Transporter</th>
                  <th>Location</th>
                </tr>
              </thead>
              <tbody>
                {trips.map((trip) => {
                  const customer = trip.customer
                    ? `${trip.customer.firstName} ${trip.customer.lastName}`
                    : "Unavailable";

                  const transporter = trip.transporter
                    ? `${trip.transporter.firstName} ${trip.transporter.lastName}`
                    : "Unavailable";

                  const hasLocation =
                    trip.vehicle?.currentLatitude !== null &&
                    trip.vehicle?.currentLatitude !== undefined &&
                    trip.vehicle?.currentLongitude !== null &&
                    trip.vehicle?.currentLongitude !== undefined;

                  return (
                    <tr
                      key={trip.id}
                      className={
                        selectedTrip?.id === trip.id ? "selected-row" : ""
                      }
                      onClick={() => void selectTrip(trip)}
                    >
                      <td>
                        <span className="operation-status">
                          {trip.status}
                        </span>
                      </td>
                      <td>
                        <strong>
                          {trip.vehicle?.registrationNumber ??
                            "Unavailable"}
                        </strong>
                        <small>
                          {trip.vehicle?.vehicleType ??
                            "Vehicle unavailable"}
                        </small>
                      </td>
                      <td>{customer}</td>
                      <td>{transporter}</td>
                      <td>
                        {hasLocation
                          ? `${trip.vehicle?.currentLatitude?.toFixed(4)}, ${trip.vehicle?.currentLongitude?.toFixed(4)}`
                          : "No location"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {!loading && trips.length === 0 && (
              <div className="empty-activity">
                <div className="empty-icon">◷</div>
                <strong>No active trips</strong>
                <span>
                  No currently active transport operations were returned
                  by the backend.
                </span>
              </div>
            )}
          </div>
        </div>

        <aside className="trip-detail-panel">
          <div className="panel-header">
            <div>
              <h2>Operation Detail</h2>
              <p>
                {selectedTrip
                  ? "Selected backend operation"
                  : "Select an active trip"}
              </p>
            </div>
          </div>

          {!selectedTrip && (
            <div className="detail-empty">
              <div className="placeholder-icon">⌁</div>
              <strong>Select an operation</strong>
              <span>
                Choose a live trip to inspect its vehicle, participants,
                status and tracking information.
              </span>
            </div>
          )}

          {selectedTrip && (
            <div className="trip-detail-content">
              {detailLoading ? (
                <div className="detail-loading">Loading operation…</div>
              ) : (
                <>
                  <div className="trip-status-block">
                    <span>Status</span>
                    <strong>{selectedTrip.status}</strong>
                  </div>

                  <div className="detail-section">
                    <span>Vehicle</span>
                    <strong>
                      {selectedTrip.vehicle?.registrationNumber ??
                        "Unavailable"}
                    </strong>
                    <small>
                      {selectedTrip.vehicle
                        ? `${selectedTrip.vehicle.vehicleType} · ${selectedTrip.vehicle.vehicleClass}`
                        : "Vehicle information unavailable"}
                    </small>
                  </div>

                  <div className="detail-section">
                    <span>Customer</span>
                    <strong>
                      {selectedTrip.customer
                        ? `${selectedTrip.customer.firstName} ${selectedTrip.customer.lastName}`
                        : "Unavailable"}
                    </strong>
                  </div>

                  <div className="detail-section">
                    <span>Transporter</span>
                    <strong>
                      {selectedTrip.transporter
                        ? `${selectedTrip.transporter.firstName} ${selectedTrip.transporter.lastName}`
                        : "Unavailable"}
                    </strong>
                  </div>

                  <div className="detail-section">
                    <span>Latest Vehicle Position</span>
                    <strong>
                      {selectedTrip.vehicle?.currentLatitude !== null &&
                      selectedTrip.vehicle?.currentLatitude !== undefined &&
                      selectedTrip.vehicle?.currentLongitude !== null &&
                      selectedTrip.vehicle?.currentLongitude !== undefined
                        ? `${selectedTrip.vehicle.currentLatitude.toFixed(5)}, ${selectedTrip.vehicle.currentLongitude.toFixed(5)}`
                        : "No location available"}
                    </strong>
                  </div>

                  {detailError && (
                    <div className="module-error">
                      <p>{detailError}</p>
                    </div>
                  )}

                  <div className="detail-section tracking-section">
                    <span>Tracking History</span>

                    {trackingLoading ? (
                      <small>Loading tracking points…</small>
                    ) : tracking.length === 0 ? (
                      <small>No tracking points available.</small>
                    ) : (
                      <div className="tracking-list">
                        {tracking.slice(0, 8).map((point) => (
                          <div className="tracking-row" key={point.id}>
                            <div>
                              <strong>
                                {point.latitude.toFixed(5)},{" "}
                                {point.longitude.toFixed(5)}
                              </strong>
                              <small>
                                {new Date(
                                  point.recordedAt,
                                ).toLocaleString()}
                              </small>
                            </div>
                            <span>
                              {point.speed !== null
                                ? `${point.speed} km/h`
                                : "Speed —"}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}

function ModuleWorkspace({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section className="module-workspace">
      <div className="module-header">
        <span className="module-kicker">
          TRANSCONET-APEX1 ADMINISTRATION
        </span>

        <h2>{title}</h2>

        <p>{description}</p>
      </div>

      <div className="module-grid">
        <div className="module-card">
          <span>MODULE STATUS</span>
          <strong>Ready for API integration</strong>
          <p>
            The workspace is established without
            displaying fabricated operational data.
          </p>
        </div>

        <div className="module-card">
          <span>AUTHORIZATION</span>
          <strong>Administrator protected</strong>
          <p>
            Access will follow the authenticated
            administrator's backend permissions.
          </p>
        </div>

        <div className="module-card">
          <span>REALTIME</span>
          <strong>Event integration ready</strong>
          <p>
            Realtime data will be connected to the
            appropriate backend event channels.
          </p>
        </div>
      </div>
    </section>
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

function HealthRow({
  label,
}: {
  label: string;
}) {
  return (
    <div className="health-row">
      <span>{label}</span>

      <span className="health-status">
        <span className="status-dot" />
        Monitoring
      </span>
    </div>
  );
}

export default App;
