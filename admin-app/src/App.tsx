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
import Disputes from "./modules/Disputes";
import Fleet from "./modules/Fleet";
import SecurityCenter from "./modules/SecurityCenter";
import NotificationCenter from "./modules/NotificationCenter";
import Messages from "./modules/Messages";
import PartnerManagement from "./modules/PartnerManagement";
import ReportCenter from "./modules/ReportCenter";
import ErrorCenter from "./modules/ErrorCenter";
import FeatureManagement from "./modules/FeatureManagement";
import RiskFraud from "./modules/RiskFraud";
import ContentManagement from "./modules/ContentManagement";
import ApiManagement from "./modules/ApiManagement";
import AIAutomation from "./modules/AIAutomation";
import ActivityTimeline from "./modules/ActivityTimeline";
import AuditLogs from "./modules/AuditLogs";
import BackupRecovery from "./modules/BackupRecovery";
import DatabaseHealth from "./modules/DatabaseHealth";
import Settings from "./modules/Settings";
import VerificationCenter from "./modules/VerificationCenter";
import { useAuthStore } from "./auth/auth.store";
import type { AdminModule } from "./api/administrators";
import { getPlatformOverview, type PlatformOverview } from "./api/admin";
import { getAdminActivity, type AdminActivity } from "./api/activity";
import { getDatabaseHealth } from "./api/database-health";
import { getApiHealth } from "./api/api-management";
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
  requiredModule?: AdminModule;
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
    label: "Partner Management",
    section: "GOVERNANCE",
    description: "Manage transporter partners, tiers, approvals, and partner fleets",
    requiredModule: "PARTNER_MANAGEMENT",
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
    requiredModule: "DISPUTES",
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
    description: "Shipment communication across in-app, email, and SMS channels",
    requiredModule: "MESSAGING",
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

  const visibleNav = primaryNav.filter(
    (item) =>
      !item.requiredModule ||
      isSuperAdministrator ||
      (user?.adminProfile?.assignedModules ?? []).includes(
        item.requiredModule,
      ),
  );

  const loadOverview = useCallback(async () => {
    try {
      setOverviewLoading(true);
      setOverviewError("");

      const data = await getPlatformOverview();
      setOverview(data);
    } catch {
      setOverviewError("Unable to load live platform overview.");
    } finally {
      setOverviewLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

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
          {visibleNav.map((item) => (
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
            assignedModules={user?.adminProfile?.assignedModules ?? []}
            isSuperAdministrator={isSuperAdministrator}
            onRefresh={() => void loadOverview()}
            onNavigate={setActive}
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
        ) : active === "Messages" ? (
          <Messages />
        ) : active === "Content Management" ? (
          <ContentManagement />
        ) : active === "Audit Logs" ? (
          <AuditLogs />
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
        ) : active === "Disputes" ? (
          <Disputes />
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
  assignedModules,
  isSuperAdministrator,
  onRefresh,
  onNavigate,
}: {
  administratorName: string;
  overview: PlatformOverview | null;
  overviewLoading: boolean;
  overviewError: string;
  assignedModules: string[];
  isSuperAdministrator: boolean;
  onRefresh: () => void;
  onNavigate: (label: string) => void;
}) {
  const [liveSummary, setLiveSummary] = useState<LiveTripSummary | null>(null);
  const [activity, setActivity] = useState<AdminActivity[]>([]);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [apiStatus, setApiStatus] = useState("Unavailable");
  const [databaseStatus, setDatabaseStatus] = useState("Unavailable");
  const [healthLoading, setHealthLoading] = useState(true);
  const [activityLoading, setActivityLoading] = useState(false);

  const canUse = (module: AdminModule) =>
    isSuperAdministrator || assignedModules.includes(module);

  const loadCommandData = useCallback(async () => {
    setHealthLoading(true);

    const tasks: Promise<void>[] = [
      getLiveTripSummary()
        .then(setLiveSummary)
        .catch(() => setLiveSummary(null)),
    ];

    if (canUse("API_MANAGEMENT")) {
      tasks.push(
        getApiHealth()
          .then((health) => {
            setApiStatus(health.status || "Unknown");
          })
          .catch(() => setApiStatus("Unavailable")),
      );
    } else {
      setApiStatus("Access restricted");
    }

    if (canUse("DATABASE_HEALTH")) {
      tasks.push(
        getDatabaseHealth()
          .then((health) => {
            setDatabaseStatus(health.status || "Unknown");
          })
          .catch(() => setDatabaseStatus("Unavailable")),
      );
    } else {
      setDatabaseStatus("Access restricted");
    }

    if (canUse("ACTIVITY_TIMELINE")) {
      setActivityLoading(true);

      tasks.push(
        getAdminActivity({ page: 1, limit: 6 })
          .then((result) => setActivity(result.activities))
          .catch(() => setActivity([]))
          .finally(() => setActivityLoading(false)),
      );
    } else {
      setActivity([]);
      setActivityLoading(false);
    }

    await Promise.all(tasks);
    setHealthLoading(false);
  }, [assignedModules, isSuperAdministrator]);

  useEffect(() => {
    void loadCommandData();

    if (!canUse("ACTIVITY_TIMELINE")) {
      return;
    }

    let cleanup: (() => void) | undefined;

    void subscribeAdminRealtime("ACTIVITY_TIMELINE", {
      onConnectionChange: setRealtimeConnected,
      onActivity: (event) => {
        const next: AdminActivity = {
          id: event.eventId,
          eventType: event.eventType,
          module: event.module ?? "PLATFORM",
          actorId: event.actorId ?? null,
          entityType: event.entityType ?? null,
          entityId: event.entityId ?? null,
          bookingId: event.bookingId ?? null,
          title: event.eventType,
          description:
            typeof event.data === "object" && event.data !== null
              ? JSON.stringify(event.data)
              : null,
          data: event.data ?? null,
          createdAt: event.timestamp,
        };

        setActivity((current) => [
          next,
          ...current.filter((item) => item.id !== next.id),
        ].slice(0, 6));
      },
    }).then((unsubscribe) => {
      cleanup = unsubscribe;
    }).catch(() => {
      setRealtimeConnected(false);
    });

    return () => {
      cleanup?.();
    };
  }, [loadCommandData, assignedModules, isSuperAdministrator]);

  const formatNumber = (value: number | undefined) =>
    typeof value === "number" ? value.toLocaleString() : "—";

  const formatTime = (value?: string) => {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? "—"
      : date.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
  };


  return (
    <div className="dashboard command-center">
      <section className="command-header">
        <div>
          <span className="eyebrow">TRANSCONET-APEX1 COMMAND CENTER</span>
          <h2>Welcome back, {administratorName}.</h2>
          <p>
            Central operational visibility for the TransConet-Apex1
            transportation and logistics platform.
          </p>
        </div>

        <div className="command-header-actions">
          <div className="sync-summary">
            <span className={`health-indicator ${overviewError ? "warning" : ""}`}>
              <span className="status-dot" />
              {overviewError ? "Overview unavailable" : "Systems connected"}
            </span>
            <small>
              Updated {formatTime(overview?.synchronizedAt)}
            </small>
          </div>

          <button
            type="button"
            className="refresh-button command-refresh"
            onClick={() => {
              onRefresh();
              void loadCommandData();
            }}
            disabled={overviewLoading || healthLoading}
          >
            {overviewLoading || healthLoading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </section>

      {overviewError && (
        <div className="module-card module-error command-error">
          <strong>Command Center overview unavailable</strong>
          <p>{overviewError}</p>
        </div>
      )}

      <section className="stats-grid command-metrics">
        <StatCard
          label="Customers"
          value={overviewLoading ? "…" : formatNumber(overview?.customers)}
          detail="Registered customer accounts"
        />
        <StatCard
          label="Transporters"
          value={overviewLoading ? "…" : formatNumber(overview?.transporters)}
          detail="Registered transporter accounts"
        />
        <StatCard
          label="Active Operations"
          value={overviewLoading ? "…" : formatNumber(overview?.activeTrips)}
          detail="Currently active trips"
        />
        <StatCard
          label="Pending Requests"
          value={overviewLoading ? "…" : formatNumber(overview?.pendingBookings)}
          detail="Bookings awaiting action"
        />
        <StatCard
          label="Verification Queue"
          value={overviewLoading ? "…" : formatNumber(overview?.pendingVerification)}
          detail="Documents awaiting review"
        />
        <StatCard
          label="Pending Payments"
          value={overviewLoading ? "…" : formatNumber(overview?.pendingPayments)}
          detail="Payments awaiting settlement"
        />
      </section>

      <section className="dashboard-grid command-primary-grid">
        <div className="panel operations-panel">
          <div className="panel-header">
            <div>
              <h2>Live Operations</h2>
              <p>Current operational status from the live-trip service</p>
            </div>
            <span className={`live-badge ${realtimeConnected ? "" : "syncing"}`}>
              <span className="status-dot" />
              {realtimeConnected ? "LIVE" : "SYNC"}
            </span>
          </div>

          <div className="command-live-summary">
            <div className="live-total">
              <span>Active operations</span>
              <strong>{liveSummary?.total ?? overview?.activeTrips ?? 0}</strong>
            </div>

            <div className="live-status-grid">
              <CommandMetric label="Assigned" value={liveSummary?.assigned} />
              <CommandMetric label="Accepted" value={liveSummary?.accepted} />
              <CommandMetric label="Arriving" value={liveSummary?.driverArriving} />
              <CommandMetric label="Arrived" value={liveSummary?.arrived} />
              <CommandMetric label="In Transit" value={liveSummary?.inTransit} />
              <CommandMetric
                label="Express Dispatch"
                value={liveSummary?.expressDispatching}
              />
            </div>
          </div>

          <div className="panel-footer-link">
            <button
              type="button"
              className="text-button"
              onClick={() => onNavigate("Live Operations")}
            >
              Open Live Operations →
            </button>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Platform Health</h2>
              <p>Health feeds available to this administrator</p>
            </div>
          </div>

          <div className="health-list">
            <HealthRow
              label="Backend API"
              value={apiStatus}
              loading={healthLoading}
            />
            <HealthRow
              label="Database"
              value={databaseStatus}
              loading={healthLoading}
            />
            <HealthRow
              label="Realtime"
              value={
                realtimeConnected
                  ? "Connected"
                  : canUse("ACTIVITY_TIMELINE")
                    ? "Disconnected"
                    : "Access restricted"
              }
              loading={false}
            />
            <HealthRow
              label="Payments"
              value="Overview monitored"
              loading={overviewLoading}
            />
            <HealthRow
              label="Notifications"
              value="Overview monitored"
              loading={overviewLoading}
            />
          </div>

          <div className="health-note">
            Payment and notification rows use the existing platform overview
            snapshot; no fabricated provider-health state is shown.
          </div>
        </div>
      </section>

      <section className="dashboard-grid command-secondary-grid">
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Needs Attention</h2>
              <p>Existing operational queues requiring administrator action</p>
            </div>
          </div>

          <div className="attention-list">
            <AttentionRow
              label="Verification"
              value={overview?.pendingVerification}
              onClick={() => onNavigate("Verification")}
            />
            <AttentionRow
              label="Pending bookings"
              value={overview?.pendingBookings}
              onClick={() => onNavigate("Bookings & Shipments")}
            />
            <AttentionRow
              label="Pending payments"
              value={overview?.pendingPayments}
              onClick={() => onNavigate("Payments")}
            />
            <AttentionRow
              label="Support tickets"
              value={overview?.supportTickets}
              onClick={() => onNavigate("Support")}
            />
            <AttentionRow
              label="Disputes"
              value={overview?.disputes}
              onClick={() => onNavigate("Disputes")}
            />
          </div>
        </div>

        <div className="panel activity-panel command-activity-panel">
          <div className="panel-header">
            <div>
              <h2>Recent Activity</h2>
              <p>Latest authorized administration events</p>
            </div>

            {canUse("ACTIVITY_TIMELINE") && (
              <span className={`status-badge ${realtimeConnected ? "status-active" : "status-warning"}`}>
                {realtimeConnected ? "LIVE" : "SYNC"}
              </span>
            )}
          </div>

          {!canUse("ACTIVITY_TIMELINE") ? (
            <div className="activity-restricted">
              <strong>Activity access not assigned</strong>
              <span>
                This administrator can continue using the Command Center
                without access to the full activity stream.
              </span>
            </div>
          ) : activityLoading ? (
            <div className="activity-restricted">
              <strong>Loading recent activity…</strong>
            </div>
          ) : activity.length === 0 ? (
            <div className="activity-restricted">
              <strong>No recent activity returned</strong>
              <span>
                The authorized activity stream currently has no events to display.
              </span>
            </div>
          ) : (
            <div className="command-activity-list">
              {activity.map((item) => (
                <div className="command-activity-item" key={item.id}>
                  <span className="activity-marker" />
                  <div>
                    <strong>{item.title}</strong>
                    <small>
                      {item.module} · {formatTime(item.createdAt)}
                    </small>
                  </div>
                </div>
              ))}
            </div>
          )}

          {canUse("ACTIVITY_TIMELINE") && (
            <div className="panel-footer-link">
              <button
                type="button"
                className="text-button"
                onClick={() => onNavigate("Activity Timeline")}
              >
                View Activity Timeline →
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function CommandMetric({
  label,
  value,
}: {
  label: string;
  value?: number;
}) {
  return (
    <div className="command-live-metric">
      <span>{label}</span>
      <strong>{value ?? "—"}</strong>
    </div>
  );
}

function AttentionRow({
  label,
  value,
  onClick,
}: {
  label: string;
  value?: number;
  onClick: () => void;
}) {
  return (
    <button type="button" className="attention-row" onClick={onClick}>
      <span>{label}</span>
      <strong>{value ?? "—"}</strong>
      <span className="attention-arrow">→</span>
    </button>
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
          event.entityType === "EXPRESS_BOOKING" &&
          event.bookingId
        ) {
          void loadOperations();

          if (selectedTrip?.id === event.bookingId) {
            void selectTripById(event.bookingId);
          }

          return;
        }

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
      <div className="live-operations-header">
        <div className="live-operations-heading">
          <span className="module-kicker">
            TRANSCONET-APEX1 OPERATIONS CONTROL
          </span>
          <h2>Live Operations</h2>
          <p>
            Monitor active transport operations, vehicle movement,
            dispatch activity and realtime trip status.
          </p>
        </div>

        <div className="live-operations-header-status">
          <span className="live-connection-indicator">
            <span
              className={`status-dot ${realtimeConnected ? "is-live" : "is-syncing"}`}
            />
            {realtimeConnected ? "Realtime connected" : "Synchronizing"}
          </span>
          <span className="live-operations-security">
            Backend-authorized data
          </span>
        </div>
      </div>

      {error && (
        <div className="module-card module-error">
          <strong>Operations unavailable</strong>
          <p>{error}</p>
        </div>
      )}

      <div className="live-operations-kpi-grid">
        <StatCard
          label="Live Trips"
          value={loading ? "…" : String(summary?.total ?? 0)}
          detail="Currently active"
        />
        <StatCard
          label="Assigned"
          value={loading ? "…" : String(summary?.assigned ?? 0)}
          detail="Awaiting progression"
        />
        <StatCard
          label="Accepted"
          value={loading ? "…" : String(summary?.accepted ?? 0)}
          detail="Transporter accepted"
        />
        <StatCard
          label="Arriving"
          value={loading ? "…" : String(summary?.driverArriving ?? 0)}
          detail="Driver approaching"
        />
        <StatCard
          label="Arrived"
          value={loading ? "…" : String(summary?.arrived ?? 0)}
          detail="At pickup point"
        />
        <StatCard
          label="In Transit"
          value={loading ? "…" : String(summary?.inTransit ?? 0)}
          detail="Trips currently moving"
        />
        <StatCard
          label="Express Dispatching"
          value={loading ? "…" : String(summary?.expressDispatching ?? 0)}
          detail={`${summary?.expressNearby ?? 0} nearby · ${summary?.expressGeneralBoard ?? 0} general board`}
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
              <option value="EXPRESS_DISPATCHING">Express dispatching</option>
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
                      <td data-label="Status">
                        <span
                          className={`operation-status ${
                            trip.expressBooking
                              ? "operation-status-express"
                              : `operation-status-${trip.status
                                  .toLowerCase()
                                  .replace(/_/g, "-")}`
                          }`}
                        >
                          <span className="operation-status-dot" />
                          {trip.expressBooking
                            ? `EXPRESS · ${trip.expressBooking.dispatchStage}`
                            : trip.status}
                        </span>
                      </td>
                      <td data-label="Vehicle">
                        <strong>
                          {trip.vehicle?.registrationNumber ??
                            (trip.expressBooking
                              ? "Awaiting assignment"
                              : "Unavailable")}
                        </strong>
                        <small>
                          {trip.vehicle?.vehicleType ??
                            (trip.expressBooking
                              ? "No vehicle assigned"
                              : "Vehicle unavailable")}
                        </small>
                      </td>
                      <td data-label="Customer">{customer}</td>
                      <td data-label="Transporter">{transporter}</td>
                      <td data-label="Location">
                        {hasLocation
                          ? `${Number(trip.vehicle?.currentLatitude).toFixed(4)}, ${Number(trip.vehicle?.currentLongitude).toFixed(4)}`
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
                    <div className="trip-status-heading">
                      <span>Current operation status</span>
                      <span className="trip-status-live">LIVE</span>
                    </div>
                    <strong>
                      {selectedTrip.expressBooking
                        ? `EXPRESS · ${selectedTrip.expressBooking.dispatchStage}`
                        : selectedTrip.status}
                    </strong>
                  </div>

                  {selectedTrip.expressBooking && (
                    <div className="detail-section express-detail-section">
                      <div className="detail-section-heading">
                        <span>Express Dispatch</span>
                        <span className="detail-section-badge">EXPRESS</span>
                      </div>
                      <strong>
                        {selectedTrip.expressBooking.dispatchStage ===
                        "GENERAL_BOARD"
                          ? "General Express Board"
                          : "Nearby Dispatch"}
                      </strong>
                      <small>
                        {selectedTrip.expressBooking.dispatchStage ===
                        "GENERAL_BOARD"
                          ? "Nearby dispatch timeout elapsed; available to eligible transporters."
                          : "Searching eligible nearby transporters first."}
                      </small>
                    </div>
                  )}

                  {selectedTrip.expressBooking && (
                    <div className="detail-section express-booking-section">
                      <div className="detail-section-heading">
                        <span>Express Booking</span>
                        <span className="detail-section-badge">BOOKING</span>
                      </div>
                      <strong>
                        {selectedTrip.expressBooking.bookingId}
                      </strong>
                      <small>
                        {selectedTrip.expressBooking.packageCount} package
                        {selectedTrip.expressBooking.packageCount === 1
                          ? ""
                          : "s"} · {selectedTrip.expressBooking.weightKg} kg ·{" "}
                        {selectedTrip.expressBooking.distanceKm} km ·{" "}
                        {selectedTrip.expressBooking.currency === "NGN"
                          ? "₦"
                          : `${selectedTrip.expressBooking.currency} `}
                        {selectedTrip.expressBooking.fare}
                      </small>
                    </div>
                  )}

                  <div className="detail-section participant-section">
                    <div className="detail-section-heading">
                      <span>Vehicle</span>
                    </div>
                    <strong>
                      {selectedTrip.vehicle?.registrationNumber ??
                        "Unavailable"}
                    </strong>
                    <small>
                      {selectedTrip.vehicle
                        ? `${selectedTrip.vehicle.vehicleType} · ${selectedTrip.vehicle.vehicleClass}`
                        : selectedTrip.expressBooking
                          ? "Awaiting transporter and vehicle assignment"
                          : "Vehicle information unavailable"}
                    </small>
                  </div>

                  <div className="detail-section participant-section">
                    <div className="detail-section-heading">
                      <span>Customer</span>
                    </div>
                    <strong>
                      {selectedTrip.customer
                        ? `${selectedTrip.customer.firstName} ${selectedTrip.customer.lastName}`
                        : "Unavailable"}
                    </strong>
                  </div>

                  <div className="detail-section participant-section">
                    <div className="detail-section-heading">
                      <span>Transporter</span>
                    </div>
                    <strong>
                      {selectedTrip.transporter
                        ? `${selectedTrip.transporter.firstName} ${selectedTrip.transporter.lastName}`
                        : "Unavailable"}
                    </strong>
                  </div>

                  <div className="detail-section location-detail-section">
                    <div className="detail-section-heading">
                      <span>Latest Vehicle Position</span>
                      <span className="detail-section-badge">GPS</span>
                    </div>
                    <strong>
                      {selectedTrip.vehicle?.currentLatitude !== null &&
                      selectedTrip.vehicle?.currentLatitude !== undefined &&
                      selectedTrip.vehicle?.currentLongitude !== null &&
                      selectedTrip.vehicle?.currentLongitude !== undefined
                        ? `${Number(selectedTrip.vehicle.currentLatitude).toFixed(5)}, ${Number(selectedTrip.vehicle.currentLongitude).toFixed(5)}`
                        : selectedTrip.expressBooking
                        ? "No vehicle assigned yet"
                        : "No location available"}
                    </strong>
                  </div>

                  {detailError && (
                    <div className="module-error">
                      <p>{detailError}</p>
                    </div>
                  )}

                  <div className="detail-section tracking-section">
                    <div className="detail-section-heading">
                      <span>Tracking History</span>
                      <span className="tracking-count">
                        {tracking.length > 8 ? "Latest 8" : `${tracking.length} point${tracking.length === 1 ? "" : "s"}`}
                      </span>
                    </div>

                    {trackingLoading ? (
                      <small>Loading tracking points…</small>
                    ) : tracking.length === 0 ? (
                      <small>
                        {selectedTrip.expressBooking && !selectedTrip.vehicle
                          ? "Tracking starts after Express dispatch assigns a transporter and vehicle."
                          : "No tracking points available."}
                      </small>
                    ) : (
                      <div className="tracking-list">
                        {tracking.slice(0, 8).map((point) => (
                          <div className="tracking-row" key={point.id}>
                            <div>
                              <strong>
                                {Number(point.latitude).toFixed(5)},{" "}
                                {Number(point.longitude).toFixed(5)}
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
  value,
  loading,
}: {
  label: string;
  value: string;
  loading?: boolean;
}) {
  const normalized = value.toLowerCase();
  const tone =
    normalized.includes("connected") ||
    normalized.includes("healthy") ||
    normalized.includes("operational") ||
    normalized.includes("monitored") ||
    normalized === "ok" ||
    normalized === "up"
      ? "status-active"
      : normalized.includes("restricted") ||
          normalized.includes("unavailable") ||
          normalized.includes("disconnected")
        ? "status-warning"
        : "";

  return (
    <div className="health-row">
      <span>{label}</span>
      <span className={`health-status ${tone}`}>
        <span className="status-dot" />
        {loading ? "Checking…" : value}
      </span>
    </div>
  );
}

export default App;
