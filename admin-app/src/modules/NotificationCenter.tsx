import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createNotification,
  getAdminNotifications,
  getNotificationSummary,
  markNotificationAsRead,
  type AdminNotification,
  type NotificationSummary,
} from "../api/notifications";

type ReadFilter = "" | "unread" | "read";

function recipientName(notification: AdminNotification) {
  const name = [
    notification.recipient?.firstName,
    notification.recipient?.lastName,
  ]
    .filter(Boolean)
    .join(" ");

  return name || notification.recipient?.email || "Unknown recipient";
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function NotificationCenter() {
  const [summary, setSummary] = useState<NotificationSummary | null>(null);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [readFilter, setReadFilter] = useState<ReadFilter>("");
  const [typeFilter, setTypeFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState("");
  const [error, setError] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [recipientId, setRecipientId] = useState("");
  const [notificationType, setNotificationType] = useState("SYSTEM_TEST");
  const [notificationTitle, setNotificationTitle] = useState("");
  const [notificationMessage, setNotificationMessage] = useState("");
  const [creating, setCreating] = useState(false);
  const notificationTypes = useMemo(() => {
    return Array.from(
      new Set(notifications.map((notification) => notification.type)),
    ).sort();
  }, [notifications]);

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const read =
        readFilter === "unread"
          ? false
          : readFilter === "read"
            ? true
            : undefined;

      const [summaryData, notificationData] = await Promise.all([
        getNotificationSummary(),
        getAdminNotifications({
          read,
          type: typeFilter || undefined,
        }),
      ]);

      setSummary(summaryData);
      setNotifications(notificationData);
    } catch (error: unknown) {
      const axiosError = error as {
        response?: {
          status?: number;
          data?: {
            error?: string;
            message?: string;
          };
        };
        message?: string;
      };

      const status = axiosError.response?.status;
      const backendError =
        axiosError.response?.data?.error ??
        axiosError.response?.data?.message ??
        axiosError.message ??
        "Unknown error";

      setError(
        status
          ? `Notification Center request failed (${status}): ${backendError}`
          : `Notification Center request failed: ${backendError}`,
      );
    } finally {
      setLoading(false);
    }
  }, [readFilter, typeFilter]);

  async function handleMarkAsRead(id: string) {
    try {
      setActionId(id);
      setError("");

      const updated = await markNotificationAsRead(id);

      setNotifications((current) =>
        current.map((notification) =>
          notification.id === id ? updated : notification,
        ),
      );

      setSummary((current) =>
        current
          ? {
              ...current,
              unread: Math.max(0, current.unread - 1),
              read: current.read + 1,
            }
          : current,
      );
    } catch {
      setError("Unable to mark the notification as read.");
    } finally {
      setActionId("");
    }
  }

async function handleCreateNotification() {
  if (!recipientId || !notificationTitle || !notificationMessage) {
    setError("Recipient, title, and message are required.");
    return;
  }

  try {
    setCreating(true);
    setError("");

    await createNotification({
      recipientId,
      type: notificationType,
      title: notificationTitle,
      message: notificationMessage,
    });

    setRecipientId("");
    setNotificationTitle("");
    setNotificationMessage("");
    setShowCreateForm(false);

    await loadNotifications();
  } catch (error) {
    setError(
      error instanceof Error
        ? error.message
        : "Unable to create notification.",
    );
  } finally {
    setCreating(false);
  }
}

  useEffect(() => {
    // Intentional: synchronize component state with the backend API.
    void loadNotifications();
  }, [loadNotifications]);

  return (
    <section className="module-workspace notification-center-workspace">
      <div className="module-header">
        <span className="module-kicker">
          TRANSCONET-APEX1 GOVERNANCE
        </span>

        <h2>Notification Center</h2>

        <p>
          Monitor platform notifications and acknowledge operational
          events generated across the TransConet-Apex1 ecosystem.
        </p>
      </div>

      {error && (
        <div className="module-card module-error">
          <strong>Notification Center unavailable</strong>
          <p>{error}</p>
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card">
          <span>Total Notifications</span>
          <strong>{loading ? "…" : summary?.total ?? 0}</strong>
          <small>All platform notifications</small>
        </div>

        <div className="stat-card">
          <span>Unread</span>
          <strong>{loading ? "…" : summary?.unread ?? 0}</strong>
          <small>Awaiting acknowledgement</small>
        </div>

        <div className="stat-card">
          <span>Read</span>
          <strong>{loading ? "…" : summary?.read ?? 0}</strong>
          <small>Previously acknowledged</small>
        </div>

        <div className="stat-card">
          <span>Visible Events</span>
          <strong>{loading ? "…" : notifications.length}</strong>
          <small>Matching current filters</small>
        </div>
      </div>

      <div className="module-card">
        <div className="module-toolbar">
          <div>
            <strong>Platform notification stream</strong>
            <span>
              Operational notifications generated by authorized platform
              services.
            </span>
            <div className="module-controls">
  <button
    type="button"
    className="refresh-button"
    onClick={() => setShowCreateForm((current) => !current)}
  >
    {showCreateForm ? "Cancel" : "Create Notification"}
  </button>
</div>

{showCreateForm && (
  <div className="module-card">
    <h3>Create platform notification</h3>

    <label>
      <span>Recipient User ID</span>
      <input
        value={recipientId}
        onChange={(event) => setRecipientId(event.target.value)}
        placeholder="Customer user ID"
      />
    </label>

    <label>
      <span>Type</span>
      <input
        value={notificationType}
        onChange={(event) => setNotificationType(event.target.value)}
      />
    </label>

    <label>
      <span>Title</span>
      <input
        value={notificationTitle}
        onChange={(event) => setNotificationTitle(event.target.value)}
        placeholder="Notification title"
      />
    </label>

    <label>
      <span>Message</span>
      <textarea
        value={notificationMessage}
        onChange={(event) => setNotificationMessage(event.target.value)}
        placeholder="Notification message"
        rows={4}
      />
    </label>

    <button
      type="button"
      className="refresh-button"
      disabled={creating}
      onClick={() => void handleCreateNotification()}
    >
      {creating ? "Creating…" : "Send Notification"}
    </button>
  </div>
)}
          </div>

          <div className="module-controls">
            <label>
              <span>Read status</span>
              <select
                value={readFilter}
                onChange={(event) =>
                  setReadFilter(event.target.value as ReadFilter)
                }
              >
                <option value="">All</option>
                <option value="unread">Unread</option>
                <option value="read">Read</option>
              </select>
            </label>

            <label>
              <span>Type</span>
              <select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
              >
                <option value="">All types</option>
                {notificationTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              className="refresh-button"
              onClick={() => void loadNotifications()}
              disabled={loading}
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>
      </div>

      <div className="module-card">
        <div className="panel-header">
          <div>
            <h2>Notifications</h2>
            <p>
              {notifications.length} notification
              {notifications.length === 1 ? "" : "s"} returned
            </p>
          </div>

          <span className="live-badge">
            <span className="status-dot" />
            PLATFORM
          </span>
        </div>

        {loading ? (
          <div className="module-empty">
            <strong>Loading notifications…</strong>
          </div>
        ) : notifications.length === 0 ? (
          <div className="module-empty">
            <strong>No notifications found</strong>
            <span>
              There are no notifications matching the current filters.
            </span>
          </div>
        ) : (
          <div className="notification-list">
            {notifications.map((notification) => (
              <article
                key={notification.id}
                className={`notification-item ${
                  notification.read ? "notification-read" : "notification-unread"
                }`}
              >
                <div className="notification-indicator">
                  {notification.read ? "✓" : "!"}
                </div>

                <div className="notification-content">
                  <div className="notification-heading">
                    <div>
                      <strong>{notification.title}</strong>
                      <span className="notification-type">
                        {notification.type}
                      </span>
                    </div>

                    <time>{formatDate(notification.createdAt)}</time>
                  </div>

                  <p>{notification.message}</p>

                  <div className="notification-meta">
                    <span>
                      Recipient: <strong>{recipientName(notification)}</strong>
                    </span>

                    {notification.relatedType && (
                      <span>
                        Related:{" "}
                        <strong>{notification.relatedType}</strong>
                        {notification.relatedId
                          ? ` / ${notification.relatedId}`
                          : ""}
                      </span>
                    )}

                    {!notification.read && (
                      <button
                        type="button"
                        className="text-button"
                        disabled={actionId === notification.id}
                        onClick={() =>
                          void handleMarkAsRead(notification.id)
                        }
                      >
                        {actionId === notification.id
                          ? "Updating…"
                          : "Mark as read"}
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default NotificationCenter;
