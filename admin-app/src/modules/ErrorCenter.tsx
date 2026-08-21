import { useEffect, useMemo, useState } from "react";
import {
  getErrorEvents,
  getErrorOverview,
  type AdminErrorEvent,
  type ErrorOverview,
} from "../api/errors";

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function severityFor(eventType: string) {
  const value = eventType.toUpperCase();

  if (value.includes("CRITICAL") || value.includes("FATAL")) return "CRITICAL";
  if (value.includes("ERROR")) return "ERROR";
  if (value.includes("FAILED")) return "FAILED";
  return "EVENT";
}

function ErrorCenter() {
  const [overview, setOverview] = useState<ErrorOverview | null>(null);
  const [events, setEvents] = useState<AdminErrorEvent[]>([]);
  const [search, setSearch] = useState("");
  const [eventType, setEventType] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<AdminErrorEvent | null>(null);
  const [error, setError] = useState("");

  async function loadErrors(initial = false) {
    try {
      if (initial) setLoading(true);
      else setRefreshing(true);

      setError("");

      const [overviewData, eventData] = await Promise.all([
        getErrorOverview(100),
        getErrorEvents({
          eventType: eventType || undefined,
          limit: 100,
        }),
      ]);

      setOverview(overviewData);
      setEvents(eventData);

      if (selected) {
        const updated = eventData.find((item) => item.id === selected.id);
        if (updated) setSelected(updated);
      }
    } catch {
      setError("Unable to load Error Center data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadErrors(true);
  }, []);

  const filteredEvents = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return events;

    return events.filter((event) =>
      [
        event.eventType,
        event.title,
        event.description ?? "",
        event.entityType ?? "",
        event.entityId ?? "",
        event.actorId ?? "",
        event.bookingId ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [events, search]);

  const errorCount = overview?.total ?? 0;
  const criticalCount = events.filter(
    (event) => severityFor(event.eventType) === "CRITICAL",
  ).length;
  const failedCount = events.filter(
    (event) => severityFor(event.eventType) === "FAILED",
  ).length;

  const eventTypes = useMemo(
    () =>
      Array.from(new Set(events.map((event) => event.eventType))).sort(),
    [events],
  );

  return (
    <section className="module-workspace">
      <div className="module-header">
        <span className="module-kicker">TRANSCONET-APEX1 SYSTEM INTELLIGENCE</span>
        <h2>Error Center</h2>
        <p>
          Monitor application and operational failures recorded by the
          administration activity system.
        </p>
      </div>

      {error && (
        <div className="module-card module-error">
          <strong>Error Center unavailable</strong>
          <p>{error}</p>
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card">
          <span>Recorded Errors</span>
          <strong>{loading ? "…" : errorCount}</strong>
          <small>Recent ERROR and FAILED events</small>
        </div>

        <div className="stat-card">
          <span>Critical Events</span>
          <strong>{loading ? "…" : criticalCount}</strong>
          <small>Events classified as critical</small>
        </div>

        <div className="stat-card">
          <span>Failed Events</span>
          <strong>{loading ? "…" : failedCount}</strong>
          <small>Operational failures currently visible</small>
        </div>

        <div className="stat-card">
          <span>Monitoring State</span>
          <strong>{loading ? "…" : "ACTIVE"}</strong>
          <small>
            {overview
              ? `Synced ${formatDate(overview.synchronizedAt)}`
              : "Backend monitoring"}
          </small>
        </div>
      </div>

      <div className="module-card">
        <div className="module-toolbar">
          <div>
            <strong>Error event stream</strong>
            <span>
              Events supplied directly by the Error Center administration API.
            </span>
          </div>

          <div className="module-controls">
            <label>
              <span>Search</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search errors, entities or actors"
              />
            </label>

            <label>
              <span>Event type</span>
              <select
                value={eventType}
                onChange={(event) => setEventType(event.target.value)}
              >
                <option value="">All event types</option>
                {eventTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              className="refresh-button"
              disabled={refreshing}
              onClick={() => void loadErrors()}
            >
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>
      </div>

      <div className="error-center-layout">
        <div className="module-card">
          <div className="panel-header">
            <div>
              <h2>Errors &amp; failures</h2>
              <p>{filteredEvents.length} matching events</p>
            </div>
          </div>

          {loading ? (
            <div className="module-empty">
              <strong>Loading Error Center…</strong>
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="module-empty">
              <strong>No error events found</strong>
              <span>Try changing the current search or event-type filter.</span>
            </div>
          ) : (
            <div className="error-event-list">
              {filteredEvents.map((event) => (
                <button
                  type="button"
                  key={event.id}
                  className={`error-event-row ${
                    selected?.id === event.id ? "active" : ""
                  }`}
                  onClick={() => setSelected(event)}
                >
                  <div>
                    <strong>{event.title}</strong>
                    <span>{event.eventType}</span>
                  </div>

                  <div>
                    <span className={`error-severity error-${severityFor(event.eventType).toLowerCase()}`}>
                      {severityFor(event.eventType)}
                    </span>
                  </div>

                  <div>
                    <span>{event.entityType ?? "SYSTEM"}</span>
                    <small>{formatDate(event.createdAt)}</small>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="module-card error-detail">
          {!selected ? (
            <div className="detail-empty">
              <strong>Select an error event</strong>
              <span>
                Event details, context and recorded metadata will appear here.
              </span>
            </div>
          ) : (
            <>
              <div className="partner-detail-header">
                <div>
                  <span className="module-kicker">ERROR EVENT</span>
                  <h2>{selected.title}</h2>
                  <p>{selected.eventType}</p>
                </div>

                <span
                  className={`error-severity error-${severityFor(
                    selected.eventType,
                  ).toLowerCase()}`}
                >
                  {severityFor(selected.eventType)}
                </span>
              </div>

              <div className="detail-grid">
                <div>
                  <span>Event ID</span>
                  <strong>{selected.id}</strong>
                </div>

                <div>
                  <span>Module</span>
                  <strong>{selected.module}</strong>
                </div>

                <div>
                  <span>Entity Type</span>
                  <strong>{selected.entityType ?? "—"}</strong>
                </div>

                <div>
                  <span>Entity ID</span>
                  <strong>{selected.entityId ?? "—"}</strong>
                </div>

                <div>
                  <span>Actor ID</span>
                  <strong>{selected.actorId ?? "SYSTEM"}</strong>
                </div>

                <div>
                  <span>Booking ID</span>
                  <strong>{selected.bookingId ?? "—"}</strong>
                </div>

                <div>
                  <span>Recorded</span>
                  <strong>{formatDate(selected.createdAt)}</strong>
                </div>
              </div>

              <div className="detail-section">
                <span>Description</span>
                <strong>{selected.description ?? "No description recorded."}</strong>
              </div>

              {selected.data !== null && selected.data !== undefined && (
                <div className="detail-section">
                  <span>Event data</span>
                  <pre>{JSON.stringify(selected.data, null, 2)}</pre>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

export default ErrorCenter;
