import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getBookingMessages,
  getMessageConversations,
  sendExternalCommunication,
  sendInAppMessage,
  type BookingMessageWorkspace,
  type CommunicationChannel,
  type MessageConversation,
  type MessageParticipant,
} from "../api/messages";
import { subscribeAdminRealtime } from "../realtime/admin-realtime";

type Channel = CommunicationChannel;

function personName(person?: MessageParticipant | null) {
  if (!person) return "Unknown";
  const name = [person.firstName, person.lastName].filter(Boolean).join(" ");
  return name || person.email || person.phone || "Unknown";
}

function initials(person?: MessageParticipant | null) {
  return personName(person)
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function statusClass(status?: string | null) {
  const normalized = (status ?? "").toLowerCase();
  if (normalized.includes("complete") || normalized === "sent") {
    return "messages-status messages-status-success";
  }
  if (
    normalized.includes("failed") ||
    normalized.includes("cancel") ||
    normalized.includes("dispute")
  ) {
    return "messages-status messages-status-danger";
  }
  return "messages-status";
}

function locationLabel(value?: string | null) {
  return value || "Location unavailable";
}

function channelLabel(channel: Channel) {
  if (channel === "IN_APP") return "In-App";
  if (channel === "EMAIL") return "Email";
  return "SMS";
}

function MessageHistory({
  workspace,
}: {
  workspace: BookingMessageWorkspace;
}) {
  const entries = useMemo(() => {
    const messages = workspace.messages.map((message) => ({
      key: `message-${message.id}`,
      channel: "IN_APP" as const,
      status: "SENT" as const,
      content: message.content,
      subject: null,
      createdAt: message.createdAt,
      sender: message.sender,
      recipient: message.recipient,
      failedReason: null,
    }));

    const communications = workspace.communicationLogs.map((log) => ({
      key: `communication-${log.id}`,
      channel: log.channel,
      status: log.status,
      content: log.content,
      subject: log.subject,
      createdAt: log.createdAt,
      sender: log.administrator,
      recipient: log.recipient,
      failedReason: log.errorMessage,
    }));

    return [...messages, ...communications].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  }, [workspace]);

  if (!entries.length) {
    return (
      <div className="messages-empty messages-history-empty">
        <div className="messages-empty-icon">M</div>
        <strong>No communication history</strong>
        <span>
          Messages, email and SMS communication for this shipment will appear
          here.
        </span>
      </div>
    );
  }

  return (
    <div className="messages-history">
      {entries.map((entry) => (
        <article className="messages-history-item" key={entry.key}>
          <div className="messages-history-avatar">
            {initials(entry.sender)}
          </div>

          <div className="messages-history-body">
            <div className="messages-history-topline">
              <strong>{personName(entry.sender)}</strong>
              <span className="messages-channel-badge">
                {channelLabel(entry.channel)}
              </span>
              <span className={statusClass(entry.status)}>
                {entry.status}
              </span>
              <time>{formatDate(entry.createdAt)}</time>
            </div>

            {entry.subject && (
              <strong className="messages-history-subject">
                {entry.subject}
              </strong>
            )}

            <p>{entry.content}</p>

            <small>
              To {personName(entry.recipient)}
              {entry.failedReason ? ` · ${entry.failedReason}` : ""}
            </small>
          </div>
        </article>
      ))}
    </div>
  );
}

export default function Messages() {
  const [conversations, setConversations] = useState<MessageConversation[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [workspace, setWorkspace] =
    useState<BookingMessageWorkspace | null>(null);
  const [search, setSearch] = useState("");
  const [channel, setChannel] = useState<Channel>("IN_APP");
  const [recipientId, setRecipientId] = useState("");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [error, setError] = useState("");
  const [sendError, setSendError] = useState("");

  const loadConversations = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const result = await getMessageConversations();
      setConversations(result);

      if (!selectedId && result.length) {
        setSelectedId(result[0].bookingId);
      } else if (
        selectedId &&
        !result.some((conversation) => conversation.bookingId === selectedId)
      ) {
        setSelectedId(result[0]?.bookingId ?? "");
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load shipment communications.",
      );
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  const loadWorkspace = useCallback(async (bookingId: string) => {
    if (!bookingId) {
      setWorkspace(null);
      return;
    }

    try {
      setDetailLoading(true);
      setError("");
      const result = await getBookingMessages(bookingId);
      setWorkspace(result);

      setRecipientId((current) => {
        if (
          current === result.customer?.id ||
          current === result.transporter?.id
        ) {
          return current;
        }
        return result.customer?.id ?? result.transporter?.id ?? "";
      });
    } catch (err) {
      setWorkspace(null);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load shipment communication history.",
      );
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    void loadWorkspace(selectedId);
  }, [selectedId, loadWorkspace]);

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    void subscribeAdminRealtime("MESSAGING", {
      onConnectionChange: (connected) => {
        if (!cancelled) setRealtimeConnected(connected);
      },
      onAccessDenied: (message) => {
        if (!cancelled) setError(message);
      },
      onActivity: (event) => {
        if (
          !event.bookingId &&
          event.entityType !== "COMMUNICATION" &&
          event.entityType !== "MESSAGE"
        ) {
          return;
        }

        void loadConversations();

        if (event.bookingId && event.bookingId === selectedId) {
          void loadWorkspace(event.bookingId);
        }
      },
      onModuleEvent: (event) => {
        if (event.bookingId === selectedId) {
          void loadWorkspace(selectedId);
        }
        void loadConversations();
      },
    })
      .then((unsubscribe) => {
        if (cancelled) {
          unsubscribe();
        } else {
          cleanup = unsubscribe;
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setRealtimeConnected(false);
          setError(
            err instanceof Error
              ? err.message
              : "Realtime communication is unavailable.",
          );
        }
      });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [loadConversations, loadWorkspace, selectedId]);

  const filteredConversations = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return conversations;

    return conversations.filter((conversation) => {
      const values = [
        conversation.bookingId,
        conversation.status,
        conversation.pickupLocation,
        conversation.destination,
        personName(conversation.customer),
        personName(conversation.transporter),
        conversation.customer?.email,
        conversation.transporter?.email,
      ];

      return values.some((value) =>
        value?.toLowerCase().includes(query),
      );
    });
  }, [conversations, search]);

  const recipients = useMemo(
    () =>
      [
        workspace?.customer,
        workspace?.transporter,
      ].filter(
        (person): person is MessageParticipant =>
          Boolean(person?.id),
      ),
    [workspace],
  );

  const canSend =
    Boolean(selectedId && recipientId && content.trim()) &&
    (channel !== "EMAIL" || Boolean(subject.trim())) &&
    !sending;

  async function handleSend() {
    if (!canSend) return;

    try {
      setSending(true);
      setSendError("");

      if (channel === "IN_APP") {
        await sendInAppMessage(selectedId, {
          recipientId,
          content: content.trim(),
        });
      } else {
        await sendExternalCommunication(selectedId, {
          recipientId,
          channel,
          subject: channel === "EMAIL" ? subject.trim() : undefined,
          content: content.trim(),
        });
      }

      setContent("");
      setSubject("");

      await Promise.all([
        loadWorkspace(selectedId),
        loadConversations(),
      ]);
    } catch (err) {
      setSendError(
        err instanceof Error
          ? err.message
          : "Unable to send shipment communication.",
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="module-workspace messages-workspace">
      <header className="messages-module-header">
        <div>
          <span className="module-kicker">
            TRANSCONET-APEX1 COMMUNICATION CONTROL
          </span>
          <h2>Shipment Communication Center</h2>
          <p>
            Communicate with customers and transporters directly from the
            shipment record using in-app messaging, email, or SMS.
          </p>
        </div>

        <div className="messages-live-indicator">
          <span
            className={`messages-live-dot ${
              realtimeConnected ? "messages-live-online" : ""
            }`}
          />
          {realtimeConnected ? "Realtime connected" : "Realtime unavailable"}
        </div>
      </header>

      {error && (
        <div className="module-card module-error messages-error">
          <strong>Communication Center unavailable</strong>
          <p>{error}</p>
          <button
            type="button"
            className="secondary-action"
            onClick={() => void loadConversations()}
          >
            Retry
          </button>
        </div>
      )}

      <div className="messages-layout">
        <aside className="messages-directory panel">
          <div className="messages-directory-header">
            <div>
              <strong>Shipment conversations</strong>
              <span>
                {filteredConversations.length} shipment
                {filteredConversations.length === 1 ? "" : "s"}
              </span>
            </div>

            <button
              type="button"
              className="refresh-button"
              onClick={() => void loadConversations()}
              disabled={loading}
            >
              {loading ? "Loading…" : "Refresh"}
            </button>
          </div>

          <label className="messages-search">
            <span>Search shipments</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Booking, customer, transporter, route…"
            />
          </label>

          {loading ? (
            <div className="messages-empty">
              <strong>Loading communications…</strong>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="messages-empty">
              <div className="messages-empty-icon">M</div>
              <strong>No shipment conversations</strong>
              <span>
                Communications appear here once a shipment has message or
                external communication activity.
              </span>
            </div>
          ) : (
            <div className="messages-conversation-list">
              {filteredConversations.map((conversation) => {
                const customer = conversation.customer;
                const transporter = conversation.transporter;

                return (
                  <button
                    type="button"
                    key={conversation.bookingId}
                    className={`messages-conversation ${
                      selectedId === conversation.bookingId
                        ? "messages-conversation-selected"
                        : ""
                    }`}
                    onClick={() => setSelectedId(conversation.bookingId)}
                  >
                    <div className="messages-conversation-avatar">
                      {initials(customer ?? transporter)}
                    </div>

                    <div className="messages-conversation-main">
                      <div className="messages-conversation-topline">
                        <strong>
                          #{conversation.bookingId.slice(0, 8)}
                        </strong>
                        <span className={statusClass(conversation.status)}>
                          {conversation.status ?? "UNKNOWN"}
                        </span>
                      </div>

                      <span>
                        {personName(customer)} · {personName(transporter)}
                      </span>

                      <small>
                        {locationLabel(conversation.pickupLocation)} →{" "}
                        {locationLabel(conversation.destination)}
                      </small>

                      <div className="messages-conversation-meta">
                        <span>
                          {(conversation.messageCount ?? 0) +
                            (conversation.communicationCount ?? 0)}{" "}
                          communications
                        </span>
                        <time>
                          {formatDate(
                            conversation.latestActivity ??
                              conversation.latestMessage?.createdAt ??
                              conversation.latestCommunication?.createdAt,
                          )}
                        </time>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        <main className="messages-detail panel">
          {!selectedId ? (
            <div className="messages-detail-empty">
              <div className="messages-empty-icon">M</div>
              <h3>Select a shipment</h3>
              <p>
                Select a shipment from the communication directory to view its
                history and send a message.
              </p>
            </div>
          ) : detailLoading || !workspace ? (
            <div className="messages-detail-empty">
              <strong>Loading shipment communication…</strong>
            </div>
          ) : (
            <>
              <header className="messages-shipment-header">
                <div>
                  <span className="module-kicker">SHIPMENT RECORD</span>
                  <h3>#{workspace.booking.id}</h3>
                  <p>
                    {locationLabel(workspace.booking.pickupLocation)} →{" "}
                    {locationLabel(workspace.booking.destination)}
                  </p>
                </div>

                <span className={statusClass(workspace.booking.status)}>
                  {workspace.booking.status ?? "UNKNOWN"}
                </span>
              </header>

              <section className="messages-context-grid">
                <div className="messages-context-card">
                  <span>Customer</span>
                  <strong>{personName(workspace.customer)}</strong>
                  <small>
                    {workspace.customer?.email ||
                      workspace.customer?.phone ||
                      "No contact details"}
                  </small>
                </div>

                <div className="messages-context-card">
                  <span>Transporter</span>
                  <strong>{personName(workspace.transporter)}</strong>
                  <small>
                    {workspace.transporter?.email ||
                      workspace.transporter?.phone ||
                      "No contact details"}
                  </small>
                </div>

                <div className="messages-context-card">
                  <span>Shipment created</span>
                  <strong>{formatDate(workspace.booking.createdAt)}</strong>
                  <small>Booking lifecycle record</small>
                </div>
              </section>

              <section className="messages-composer">
                <div className="messages-section-heading">
                  <div>
                    <strong>Send communication</strong>
                    <span>
                      Choose the recipient and delivery channel for this
                      shipment.
                    </span>
                  </div>
                </div>

                <div className="messages-recipient-row">
                  {recipients.map((recipient) => (
                    <button
                      type="button"
                      key={recipient.id}
                      className={`messages-recipient ${
                        recipientId === recipient.id
                          ? "messages-recipient-selected"
                          : ""
                      }`}
                      onClick={() => setRecipientId(recipient.id)}
                      disabled={sending}
                    >
                      <span className="messages-recipient-avatar">
                        {initials(recipient)}
                      </span>
                      <span>
                        <strong>{personName(recipient)}</strong>
                        <small>
                          {recipient.id === workspace.customer?.id
                            ? "Customer"
                            : "Transporter"}
                        </small>
                      </span>
                    </button>
                  ))}
                </div>

                <div className="messages-channel-tabs">
                  {(["IN_APP", "EMAIL", "SMS"] as Channel[]).map(
                    (option) => (
                      <button
                        type="button"
                        key={option}
                        className={
                          channel === option
                            ? "messages-channel-active"
                            : ""
                        }
                        onClick={() => setChannel(option)}
                        disabled={sending}
                      >
                        <strong>{channelLabel(option)}</strong>
                        <small>
                          {option === "IN_APP"
                            ? "Platform inbox"
                            : option === "EMAIL"
                              ? "Email delivery"
                              : "Termii SMS"}
                        </small>
                      </button>
                    ),
                  )}
                </div>

                {channel === "EMAIL" && (
                  <label className="messages-field">
                    <span>Email subject</span>
                    <input
                      value={subject}
                      onChange={(event) => setSubject(event.target.value)}
                      placeholder="Shipment communication subject"
                      disabled={sending}
                      maxLength={200}
                    />
                  </label>
                )}

                <label className="messages-field">
                  <span>Message</span>
                  <textarea
                    value={content}
                    onChange={(event) => setContent(event.target.value)}
                    placeholder={
                      channel === "SMS"
                        ? "Write the SMS to the shipment recipient…"
                        : "Write the shipment communication…"
                    }
                    disabled={sending}
                    maxLength={channel === "SMS" ? 1600 : 5000}
                    rows={5}
                  />
                  <small>
                    {content.length}/
                    {channel === "SMS" ? "1600" : "5000"} characters
                  </small>
                </label>

                {sendError && (
                  <div className="module-error messages-send-error">
                    <p>{sendError}</p>
                  </div>
                )}

                <div className="messages-composer-footer">
                  <span>
                    {channel === "IN_APP"
                      ? "Delivered inside the TransConet platform."
                      : channel === "EMAIL"
                        ? "Sent through the existing business email provider."
                        : "Sent through the existing Termii SMS provider."}
                  </span>

                  <button
                    type="button"
                    className="primary-action"
                    onClick={() => void handleSend()}
                    disabled={!canSend}
                  >
                    {sending
                      ? "Sending…"
                      : `Send ${channelLabel(channel)}`}
                  </button>
                </div>
              </section>

              <section className="messages-history-section">
                <div className="messages-section-heading">
                  <div>
                    <strong>Communication history</strong>
                    <span>
                      Complete shipment communication record across all
                      supported channels.
                    </span>
                  </div>
                </div>

                <MessageHistory workspace={workspace} />
              </section>
            </>
          )}
        </main>
      </div>
    </section>
  );
}
