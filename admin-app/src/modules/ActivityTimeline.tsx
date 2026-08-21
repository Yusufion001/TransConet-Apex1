import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getAdminActivity,
  type AdminActivity,
  type ActivityResult,
} from "../api/activity";

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function eventClass(eventType: string) {
  const value = eventType.toUpperCase();

  if (
    value.includes("ERROR") ||
    value.includes("FAILED") ||
    value.includes("REJECT")
  ) {
    return "status-warning";
  }

  if (
    value.includes("SUCCESS") ||
    value.includes("COMPLETED") ||
    value.includes("APPROVED")
  ) {
    return "status-active";
  }

  return "status-neutral";
}

function ActivityTimeline() {
  const [result, setResult] = useState<ActivityResult | null>(null);
  const [selected, setSelected] = useState<AdminActivity | null>(null);
  const [module, setModule] = useState("");
  const [eventType, setEventType] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadActivity = useCallback(
    async (initial = false) => {
      try {
        if (initial) setLoading(true);
        else setRefreshing(true);

        setError("");

        const data = await getAdminActivity({
          module: module || undefined,
          eventType: eventType || undefined,
          page,
          limit: 25,
        });

        setResult(data);

        if (selected) {
          const updated = data.activities.find(
            (activity) => activity.id === selected.id,
          );

          setSelected(updated ?? null);
        }
      } catch {
        setError(
          "Unable to load Activity Timeline. Verify that your administrator account has ACTIVITY_TIMELINE permission.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [eventType, module, page, selected],
  );

  useEffect(() => {
    void loadActivity(true);
  }, [loadActivity]);

  const activities = result?.activities ?? [];

  const modules = useMemo(
    () =>
      Array.from(
        new Set(activities.map((activity) => activity.module)),
      ).sort(),
    [activities],
  );

  const eventTypes = useMemo(
    () =>
      Array.from(
        new Set(activities.map((activity) => activity.eventType)),
      ).sort(),
    [activities],
  );

  const filteredActivities = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return activities;

    return activities.filter((activity) =>
      [
        activity.eventType,
        activity.module,
        activity.title,
        activity.description ?? "",
        activity.actorId ?? "",
        activity.entityType ?? "",
        activity.entityId ?? "",
        activity.bookingId ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [activities, search]);

  const pagination = result?.pagination;

  return (
    <section className="module-workspace">
      <div className="module-header">
        <div>
          <span className="module-kicker">
            TRANSCONET-APEX1 OPERATIONS INTELLIGENCE
          </span>
          <h2>Activity Timeline</h2>
          <p>
            Review administrative and operational events persisted by the
            platform activity system.
          </p>
        </div>

        <button
          type="button"
          className="text-button"
          onClick={() => void loadActivity(false)}
          disabled={refreshing}
        >
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="module-card module-error">
          <strong>Activity Timeline unavailable</strong>
          <p>{error}</p>
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card">
          <span>Events</span>
          <strong>{loading ? "…" : pagination?.total ?? 0}</strong>
          <small>Total matching activity records</small>
        </div>

        <div className="stat-card">
          <span>Visible</span>
          <strong>{loading ? "…" : filteredActivities.length}</strong>
          <small>Events on the current page</small>
        </div>

        <div className="stat-card">
          <span>Modules</span>
          <strong>{loading ? "…" : modules.length}</strong>
          <small>Modules represented on this page</small>
        </div>

        <div className="stat-card">
          <span>Page</span>
          <strong>
            {loading
              ? "…"
              : `${pagination?.page ?? 1} / ${pagination?.totalPages ?? 1}`}
          </strong>
          <small>Server-side activity pagination</small>
        </div>
      </div>

      <section className="module-card">
        <div className="module-toolbar">
          <div>
            <strong>Activity stream</strong>
            <span>
              Activity records are retrieved directly from the backend.
            </span>
          </div>

          <div className="module-controls">
            <label>
              <span>Search</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search events, entities or actors"
              />
            </label>

            <label>
              <span>Module</span>
              <select
                value={module}
                onChange={(event) => {
                  setModule(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">All modules</option>
                {modules.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Event type</span>
              <select
                value={eventType}
                onChange={(event) => {
                  setEventType(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">All event types</option>
                {eventTypes.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {loading ? (
          <div className="customer-state">
            <strong>Loading activity…</strong>
            <span>Retrieving the latest administrative activity.</span>
          </div>
        ) : filteredActivities.length === 0 ? (
          <div className="customer-state">
            <strong>No activity found</strong>
            <span>
              No events match the current filters.
            </span>
          </div>
        ) : (
          <div className="health-list">
            {filteredActivities.map((activity) => (
              <button
                key={activity.id}
                type="button"
                className="health-row"
                onClick={() => setSelected(activity)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  cursor: "pointer",
                  background: "transparent",
                  border: 0,
                }}
              >
                <span>
                  <strong>{activity.title || activity.eventType}</strong>
                  <br />
                  <small>
                    {activity.module} · {formatDate(activity.createdAt)}
                  </small>
                </span>

                <span
                  className={`status-badge ${eventClass(
                    activity.eventType,
                  )}`}
                >
                  {activity.eventType}
                </span>
              </button>
            ))}
          </div>
        )}

        {pagination && pagination.totalPages > 1 && (
          <div className="module-toolbar">
            <span>
              Page {pagination.page} of {pagination.totalPages}
            </span>

            <div className="module-controls">
              <button
                type="button"
                className="text-button"
                disabled={page <= 1 || refreshing}
                onClick={() => setPage((value) => Math.max(value - 1, 1))}
              >
                Previous
              </button>

              <button
                type="button"
                className="text-button"
                disabled={
                  page >= pagination.totalPages || refreshing
                }
                onClick={() =>
                  setPage((value) =>
                    Math.min(value + 1, pagination.totalPages),
                  )
                }
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>

      {selected && (
        <section className="module-card">
          <div className="module-toolbar">
            <div>
              <strong>Event details</strong>
              <span>
                Full activity record for the selected event.
              </span>
            </div>

            <button
              type="button"
              className="text-button"
              onClick={() => setSelected(null)}
            >
              Close
            </button>
          </div>

          <div className="health-list">
            <div className="health-row">
              <span>Event ID</span>
              <strong>{selected.id}</strong>
            </div>

            <div className="health-row">
              <span>Event type</span>
              <strong>{selected.eventType}</strong>
            </div>

            <div className="health-row">
              <span>Module</span>
              <strong>{selected.module}</strong>
            </div>

            <div className="health-row">
              <span>Actor</span>
              <strong>{selected.actorId ?? "System"}</strong>
            </div>

            <div className="health-row">
              <span>Entity</span>
              <strong>
                {selected.entityType
                  ? `${selected.entityType}${selected.entityId ? ` · ${selected.entityId}` : ""}`
                  : "—"}
              </strong>
            </div>

            <div className="health-row">
              <span>Booking</span>
              <strong>{selected.bookingId ?? "—"}</strong>
            </div>

            <div className="health-row">
              <span>Created</span>
              <strong>{formatDate(selected.createdAt)}</strong>
            </div>
          </div>

          {selected.description && (
            <div className="module-card">
              <strong>Description</strong>
              <p>{selected.description}</p>
            </div>
          )}

          <div className="module-card">
            <strong>Event data</strong>
            <pre
              style={{
                overflowX: "auto",
                whiteSpace: "pre-wrap",
                marginTop: "12px",
              }}
            >
              {JSON.stringify(selected.data ?? {}, null, 2)}
            </pre>
          </div>
        </section>
      )}
    </section>
  );
}

export default ActivityTimeline;
