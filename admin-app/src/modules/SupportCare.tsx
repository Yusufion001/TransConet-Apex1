import { useEffect, useMemo, useState } from "react";
import {
  assignSupportTicket,
  getAdminSupportTickets,
  updateSupportTicketStatus,
  type SupportPriority,
  type SupportStatus,
  type SupportTicket,
} from "../api/support";
import {
  getAdministrators,
  type Administrator,
} from "../api/administrators";

const STATUS_ORDER: SupportStatus[] = [
  "OPEN",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
];

const PRIORITY_ORDER: SupportPriority[] = [
  "URGENT",
  "HIGH",
  "MEDIUM",
  "LOW",
];

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function label(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function personName(
  user?: {
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null,
) {
  if (!user) return "Unknown requester";

  const name = [user.firstName, user.lastName]
    .filter(Boolean)
    .join(" ");

  return name || user.email || user.phone || "Unknown requester";
}

function statusClass(status: SupportStatus) {
  return `support-status support-status-${status.toLowerCase()}`;
}

function priorityClass(priority: SupportPriority) {
  return `support-priority support-priority-${priority.toLowerCase()}`;
}

export default function SupportCare() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] =
    useState<SupportStatus | "ALL">("ALL");
  const [priorityFilter, setPriorityFilter] =
    useState<SupportPriority | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [administrators, setAdministrators] = useState<Administrator[]>([]);
  const [administratorsLoading, setAdministratorsLoading] = useState(true);

  async function loadAdministrators() {
    try {
      setAdministratorsLoading(true);

      const data = await getAdministrators();

      setAdministrators(
        data.filter(
          (administrator) =>
            administrator.status === "ACTIVE" &&
            (administrator.isSuperAdministrator ||
              administrator.administratorType === "SUPER_ADMIN" ||
              administrator.assignedModules.includes("SUPPORT_CARE")),
        ),
      );
    } catch (requestError) {
      setActionError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load support administrators.",
      );
    } finally {
      setAdministratorsLoading(false);
    }
  }

  async function loadTickets() {
    try {
      setLoading(true);
      setError("");

      const data = await getAdminSupportTickets({
        status: statusFilter === "ALL" ? undefined : statusFilter,
        priority:
          priorityFilter === "ALL" ? undefined : priorityFilter,
      });

      setTickets(data);

      setSelectedId((current) => {
        if (current && data.some((ticket) => ticket.id === current)) {
          return current;
        }

        return data[0]?.id ?? null;
      });
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load support tickets.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTickets();
  }, [statusFilter, priorityFilter]);

  useEffect(() => {
    void loadAdministrators();
  }, []);

  const filteredTickets = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return tickets;

    return tickets.filter((ticket) => {
      const haystack = [
        ticket.subject,
        ticket.description,
        ticket.category,
        ticket.priority,
        ticket.status,
        ticket.id,
        ticket.bookingId ?? "",
        personName(ticket.requester),
        ticket.requester?.email ?? "",
        ticket.requester?.phone ?? "",
        personName(ticket.assignedAdmin),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [tickets, search]);

  const selectedTicket = tickets.find(
    (ticket) => ticket.id === selectedId,
  );

  const metrics = useMemo(
    () => ({
      total: tickets.length,
      open: tickets.filter((ticket) => ticket.status === "OPEN").length,
      inProgress: tickets.filter(
        (ticket) => ticket.status === "IN_PROGRESS",
      ).length,
      urgent: tickets.filter(
        (ticket) => ticket.priority === "URGENT",
      ).length,
      resolved: tickets.filter(
        (ticket) =>
          ticket.status === "RESOLVED" ||
          ticket.status === "CLOSED",
      ).length,
    }),
    [tickets],
  );

  async function changeStatus(status: SupportStatus) {
    if (!selectedTicket) return;

    try {
      setActionLoading(true);
      setActionError("");

      await updateSupportTicketStatus(selectedTicket.id, status);
      await loadTickets();
    } catch (requestError) {
      setActionError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to update ticket status.",
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function handleAssign(administratorId: string) {
    if (!selectedTicket) return;

    if (!administratorId) {
      setActionError("Select an administrator to assign this ticket.");
      return;
    }

    try {
      setActionLoading(true);
      setActionError("");

      await assignSupportTicket(
        selectedTicket.id,
        administratorId,
      );
      await loadTickets();
    } catch (requestError) {
      setActionError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to assign this ticket.",
      );
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <section className="module-shell">
        <div className="module-header">
          <div>
            <span className="module-eyebrow">
              CUSTOMER EXPERIENCE / SUPPORT & CARE
            </span>
            <h1>Support & Care</h1>
            <p>Loading support operations…</p>
          </div>
        </div>

        <div className="module-loading">
          Loading support tickets…
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
              CUSTOMER EXPERIENCE / SUPPORT & CARE
            </span>
            <h1>Support & Care</h1>
            <p>Support administration could not be loaded.</p>
          </div>
        </div>

        <div className="module-error">
          <strong>Unable to load support tickets</strong>
          <span>{error}</span>
          <button type="button" onClick={() => void loadTickets()}>
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
            CUSTOMER EXPERIENCE / SUPPORT & CARE
          </span>

          <h1>Support & Care</h1>

          <p>
            Manage customer and transporter support requests,
            ownership, priorities, and resolution states across
            TransConet.
          </p>
        </div>

        <button
          type="button"
          className="module-refresh"
          onClick={() => void loadTickets()}
          disabled={actionLoading}
        >
          Refresh
        </button>
      </div>

      <div className="support-metrics">
        <button
          type="button"
          className="support-metric"
          onClick={() => setStatusFilter("OPEN")}
        >
          <span>Open</span>
          <strong>{metrics.open}</strong>
        </button>

        <button
          type="button"
          className="support-metric"
          onClick={() => setStatusFilter("IN_PROGRESS")}
        >
          <span>In progress</span>
          <strong>{metrics.inProgress}</strong>
        </button>

        <div className="support-metric">
          <span>Urgent</span>
          <strong>{metrics.urgent}</strong>
        </div>

        <div className="support-metric">
          <span>Resolved / closed</span>
          <strong>{metrics.resolved}</strong>
        </div>

        <div className="support-metric">
          <span>Total loaded</span>
          <strong>{metrics.total}</strong>
        </div>
      </div>

      <div className="support-toolbar">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search requester, subject, booking or ticket"
          aria-label="Search support tickets"
        />

        <select
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(
              event.target.value as SupportStatus | "ALL",
            )
          }
          aria-label="Filter support tickets by status"
        >
          <option value="ALL">All statuses</option>
          {STATUS_ORDER.map((status) => (
            <option key={status} value={status}>
              {label(status)}
            </option>
          ))}
        </select>

        <select
          value={priorityFilter}
          onChange={(event) =>
            setPriorityFilter(
              event.target.value as SupportPriority | "ALL",
            )
          }
          aria-label="Filter support tickets by priority"
        >
          <option value="ALL">All priorities</option>
          {PRIORITY_ORDER.map((priority) => (
            <option key={priority} value={priority}>
              {label(priority)}
            </option>
          ))}
        </select>
      </div>

      <div className="support-workspace">
        <div className="support-directory">
          <div className="support-directory-header">
            <div>
              <h2>Support queue</h2>
              <span>{filteredTickets.length} tickets</span>
            </div>
          </div>

          {filteredTickets.length === 0 ? (
            <div className="support-empty">
              No support tickets match the current filters.
            </div>
          ) : (
            <div className="support-table-wrap">
              <table className="support-table">
                <thead>
                  <tr>
                    <th>Requester</th>
                    <th>Issue</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Assigned</th>
                    <th>Created</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredTickets.map((ticket) => (
                    <tr
                      key={ticket.id}
                      className={
                        ticket.id === selectedId
                          ? "support-row-selected"
                          : ""
                      }
                      onClick={() => {
                        setSelectedId(ticket.id);
                        setActionError("");
                      }}
                    >
                      <td>
                        <strong>{personName(ticket.requester)}</strong>
                        <span>
                          {ticket.requester?.email ??
                            ticket.requester?.phone ??
                            ticket.requesterId}
                        </span>
                      </td>

                      <td>
                        <strong>{ticket.subject}</strong>
                        <span>
                          {ticket.category}
                          {ticket.bookingId
                            ? ` • Booking ${ticket.bookingId.slice(0, 8)}`
                            : ""}
                        </span>
                      </td>

                      <td>
                        <span className={priorityClass(ticket.priority)}>
                          {label(ticket.priority)}
                        </span>
                      </td>

                      <td>
                        <span className={statusClass(ticket.status)}>
                          {label(ticket.status)}
                        </span>
                      </td>

                      <td>
                        <span>
                          {personName(ticket.assignedAdmin)}
                        </span>
                      </td>

                      <td>{formatDate(ticket.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <aside className="support-detail">
          {!selectedTicket ? (
            <div className="support-empty">
              Select a support ticket to inspect it.
            </div>
          ) : (
            <>
              <div className="support-detail-header">
                <span className="module-eyebrow">
                  SUPPORT TICKET
                </span>

                <h2>{selectedTicket.subject}</h2>

                <div className="support-detail-badges">
                  <span className={statusClass(selectedTicket.status)}>
                    {label(selectedTicket.status)}
                  </span>

                  <span
                    className={priorityClass(selectedTicket.priority)}
                  >
                    {label(selectedTicket.priority)}
                  </span>
                </div>
              </div>

              <div className="support-detail-grid">
                <div>
                  <span>Requester</span>
                  <strong>
                    {personName(selectedTicket.requester)}
                  </strong>
                </div>

                <div>
                  <span>Category</span>
                  <strong>{selectedTicket.category}</strong>
                </div>

                <div>
                  <span>Email</span>
                  <strong>
                    {selectedTicket.requester?.email ?? "—"}
                  </strong>
                </div>

                <div>
                  <span>Phone</span>
                  <strong>
                    {selectedTicket.requester?.phone ?? "—"}
                  </strong>
                </div>

                <div>
                  <span>Booking</span>
                  <strong>
                    {selectedTicket.bookingId ?? "No booking"}
                  </strong>
                </div>

                <div>
                  <span>Assigned administrator</span>
                  <strong>
                    {personName(selectedTicket.assignedAdmin)}
                  </strong>
                </div>

                <div>
                  <span>Created</span>
                  <strong>
                    {formatDate(selectedTicket.createdAt)}
                  </strong>
                </div>

                <div>
                  <span>Updated</span>
                  <strong>
                    {formatDate(selectedTicket.updatedAt)}
                  </strong>
                </div>
              </div>

              <div className="support-description">
                <span>Customer / transporter description</span>
                <p>{selectedTicket.description}</p>
              </div>

              {actionError && (
                <div className="support-action-error">
                  {actionError}
                </div>
              )}

              <div className="support-actions">
                <div>
                  <label htmlFor="support-status">
                    Update status
                  </label>

                  <select
                    id="support-status"
                    value={selectedTicket.status}
                    onChange={(event) =>
                      void changeStatus(
                        event.target.value as SupportStatus,
                      )
                    }
                    disabled={actionLoading}
                  >
                    {STATUS_ORDER.map((status) => (
                      <option key={status} value={status}>
                        {label(status)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="support-administrator">
                    Assign administrator
                  </label>

                  <select
                    id="support-administrator"
                    value=""
                    onChange={(event) =>
                      void handleAssign(event.target.value)
                    }
                    disabled={
                      actionLoading ||
                      administratorsLoading ||
                      administrators.length === 0
                    }
                  >
                    <option value="">
                      {administratorsLoading
                        ? "Loading administrators…"
                        : administrators.length === 0
                          ? "No support administrators available"
                          : "Select administrator"}
                    </option>

                    {administrators.map((administrator) => (
                      <option
                        key={administrator.userId}
                        value={administrator.userId}
                      >
                        {personName(administrator.user)} —{" "}
                        {label(administrator.administratorType)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}
        </aside>
      </div>
    </section>
  );
}
