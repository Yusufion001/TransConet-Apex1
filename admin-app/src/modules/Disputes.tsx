import { useCallback, useEffect, useMemo, useState } from "react";
import {
  assignAdminDispute,
  getAdminDisputes,
  getAdminDispute,
  updateAdminDispute,
  type AdminDispute,
  type DisputeStatus,
} from "../api/disputes";
import {
  getAdministrators,
  type Administrator,
} from "../api/administrators";
import { subscribeAdminRealtime } from "../realtime/admin-realtime";

const STATUS_ORDER: DisputeStatus[] = [
  "OPEN",
  "INVESTIGATING",
  "RESOLVED",
  "REJECTED",
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
  if (!user) return "Unassigned";

  const name = [user.firstName, user.lastName]
    .filter(Boolean)
    .join(" ");

  return name || user.email || user.phone || "Unknown";
}

function statusClass(status: DisputeStatus) {
  return `dispute-status dispute-status-${status.toLowerCase()}`;
}

export default function Disputes() {
  const [disputes, setDisputes] = useState<AdminDispute[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] =
    useState<AdminDispute | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [statusFilter, setStatusFilter] =
    useState<DisputeStatus | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [administrators, setAdministrators] = useState<Administrator[]>([]);
  const [administratorsLoading, setAdministratorsLoading] =
    useState(true);
  const [resolution, setResolution] = useState("");

  const loadDisputes = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const data = await getAdminDisputes({
        status: statusFilter === "ALL" ? undefined : statusFilter,
        search: search.trim() || undefined,
      });

      setDisputes(data);

      setSelectedId((current) => {
        if (current && data.some((dispute) => dispute.id === current)) {
          return current;
        }

        return data[0]?.id ?? null;
      });
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load disputes.",
      );
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  const loadAdministrators = useCallback(async () => {
    try {
      setAdministratorsLoading(true);

      const data = await getAdministrators();

      setAdministrators(
        data.filter(
          (administrator) =>
            administrator.status === "ACTIVE" &&
            (administrator.isSuperAdministrator ||
              administrator.administratorType === "SUPER_ADMIN" ||
              administrator.assignedModules.includes("DISPUTES")),
        ),
      );
    } catch (requestError) {
      setActionError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load dispute administrators.",
      );
    } finally {
      setAdministratorsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDisputes();
  }, [loadDisputes]);

  useEffect(() => {
    void loadAdministrators();
  }, [loadAdministrators]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    void subscribeAdminRealtime("DISPUTES", {
      onModuleEvent: () => {
        void loadDisputes();
      },
    })
      .then((cleanup) => {
        unsubscribe = cleanup;
      })
      .catch(() => {
        // API polling/manual refresh remains available if realtime is unavailable.
      });

    return () => {
      unsubscribe?.();
    };
  }, [loadDisputes]);

  const selectedDispute = disputes.find(
    (dispute) => dispute.id === selectedId,
  );

  useEffect(() => {
    if (!selectedId) {
      setSelectedDetail(null);
      return;
    }

    let active = true;

    void (async () => {
      try {
        setDetailLoading(true);
        const detail = await getAdminDispute(selectedId);

        if (active) {
          setSelectedDetail(detail);
        }
      } catch (requestError) {
        if (active) {
          setSelectedDetail(null);
          setActionError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to load dispute details.",
          );
        }
      } finally {
        if (active) {
          setDetailLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [selectedId]);

  useEffect(() => {
    setResolution(
      (selectedDetail ?? selectedDispute)?.resolution ?? "",
    );
    setActionError("");
  }, [selectedId, selectedDetail?.resolution, selectedDispute?.resolution]);

  const metrics = useMemo(
    () => ({
      total: disputes.length,
      open: disputes.filter(
        (dispute) => dispute.status === "OPEN",
      ).length,
      investigating: disputes.filter(
        (dispute) => dispute.status === "INVESTIGATING",
      ).length,
      resolved: disputes.filter(
        (dispute) => dispute.status === "RESOLVED",
      ).length,
      rejected: disputes.filter(
        (dispute) => dispute.status === "REJECTED",
      ).length,
    }),
    [disputes],
  );

  async function handleAssign(administratorId: string) {
    if (!selectedDispute || !administratorId) return;

    try {
      setActionLoading(true);
      setActionError("");

      const updated = await assignAdminDispute(
        selectedDispute.id,
        administratorId,
      );

      setDisputes((current) =>
        current.map((dispute) =>
          dispute.id === updated.id ? updated : dispute,
        ),
      );
    } catch (requestError) {
      setActionError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to assign dispute.",
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function handleStatus(status: DisputeStatus) {
    if (!selectedDispute) return;

    if (
      (status === "RESOLVED" || status === "REJECTED") &&
      resolution.trim().length < 3
    ) {
      setActionError(
        "A resolution is required before resolving or rejecting a dispute.",
      );
      return;
    }

    try {
      setActionLoading(true);
      setActionError("");

      const updated = await updateAdminDispute(
        selectedDispute.id,
        status,
        resolution,
      );

      setDisputes((current) =>
        current.map((dispute) =>
          dispute.id === updated.id ? updated : dispute,
        ),
      );
    } catch (requestError) {
      setActionError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to update dispute.",
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
              GOVERNANCE / DISPUTES
            </span>
            <h1>Disputes</h1>
            <p>Loading dispute management operations…</p>
          </div>
        </div>

        <div className="module-loading">
          Loading disputes…
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
              GOVERNANCE / DISPUTES
            </span>
            <h1>Disputes</h1>
            <p>Dispute management could not be loaded.</p>
          </div>
        </div>

        <div className="module-error">
          <strong>Unable to load disputes</strong>
          <span>{error}</span>
          <button type="button" onClick={() => void loadDisputes()}>
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
            GOVERNANCE / DISPUTES
          </span>

          <h1>Disputes</h1>

          <p>
            Review customer and transporter disputes, assign
            responsibility, investigate cases, and record final
            resolutions across TransConet.
          </p>
        </div>

        <button
          type="button"
          className="module-refresh"
          onClick={() => void loadDisputes()}
          disabled={actionLoading}
        >
          Refresh
        </button>
      </div>

      <div className="dispute-metrics">
        <button
          type="button"
          className="dispute-metric"
          onClick={() => setStatusFilter("OPEN")}
        >
          <span>Open</span>
          <strong>{metrics.open}</strong>
        </button>

        <button
          type="button"
          className="dispute-metric"
          onClick={() => setStatusFilter("INVESTIGATING")}
        >
          <span>Investigating</span>
          <strong>{metrics.investigating}</strong>
        </button>

        <div className="dispute-metric">
          <span>Resolved</span>
          <strong>{metrics.resolved}</strong>
        </div>

        <div className="dispute-metric">
          <span>Rejected</span>
          <strong>{metrics.rejected}</strong>
        </div>

        <div className="dispute-metric">
          <span>Total loaded</span>
          <strong>{metrics.total}</strong>
        </div>
      </div>

      <div className="dispute-toolbar">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search customer, transporter, booking or dispute"
          aria-label="Search disputes"
        />

        <select
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(
              event.target.value as DisputeStatus | "ALL",
            )
          }
          aria-label="Filter disputes by status"
        >
          <option value="ALL">All statuses</option>
          {STATUS_ORDER.map((status) => (
            <option key={status} value={status}>
              {label(status)}
            </option>
          ))}
        </select>
      </div>

      <div className="dispute-workspace">
        <div className="dispute-directory">
          <div className="dispute-directory-header">
            <div>
              <h2>Dispute queue</h2>
              <span>{disputes.length} cases</span>
            </div>
          </div>

          {disputes.length === 0 ? (
            <div className="dispute-empty">
              No disputes match the current filters.
            </div>
          ) : (
            <div className="dispute-table-wrap">
              <table className="dispute-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Transporter</th>
                    <th>Booking</th>
                    <th>Status</th>
                    <th>Assigned</th>
                    <th>Created</th>
                  </tr>
                </thead>

                <tbody>
                  {disputes.map((dispute) => (
                    <tr
                      key={dispute.id}
                      className={
                        dispute.id === selectedId
                          ? "dispute-row-selected"
                          : ""
                      }
                      onClick={() => {
                        setSelectedId(dispute.id);
                        setActionError("");
                      }}
                    >
                      <td>
                        <strong>{personName(dispute.customer)}</strong>
                        <span>
                          {dispute.customer.email ??
                            dispute.customer.phone ??
                            dispute.customerId}
                        </span>
                      </td>

                      <td>
                        <strong>
                          {personName(dispute.transporter)}
                        </strong>
                        <span>
                          {dispute.transporter?.email ??
                            dispute.transporter?.phone ??
                            "—"}
                        </span>
                      </td>

                      <td>
                        <strong>
                          {dispute.bookingId.slice(0, 8)}
                        </strong>
                        <span>
                          {label(dispute.booking.status)}
                        </span>
                      </td>

                      <td>
                        <span
                          className={statusClass(dispute.status)}
                        >
                          {label(dispute.status)}
                        </span>
                      </td>

                      <td>
                        <span>
                          {personName(dispute.administrator)}
                        </span>
                      </td>

                      <td>{formatDate(dispute.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <aside className="dispute-detail">
          {!selectedDispute ? (
            <div className="dispute-empty">
              Select a dispute to inspect it.
            </div>
          ) : (
            <>
              <div className="dispute-detail-header">
                <span className="module-eyebrow">
                  DISPUTE CASE
                </span>

                <h2>
                  Booking {selectedDispute.bookingId.slice(0, 8)}
                </h2>

                <div className="dispute-detail-badges">
                  <span
                    className={statusClass(selectedDispute.status)}
                  >
                    {label(selectedDispute.status)}
                  </span>
                </div>
              </div>

              {detailLoading ? (
                <div className="dispute-empty">
                  Loading complete dispute details…
                </div>
              ) : (
              <>
              <div className="dispute-detail-grid">
                <div>
                  <span>Customer</span>
                  <strong>
                    {personName(
                      (selectedDetail ?? selectedDispute).customer,
                    )}
                  </strong>
                </div>

                <div>
                  <span>Customer email</span>
                  <strong>
                    {(selectedDetail ?? selectedDispute).customer.email ?? "—"}
                  </strong>
                </div>

                <div>
                  <span>Transporter</span>
                  <strong>
                    {personName(
                      (selectedDetail ?? selectedDispute).transporter,
                    )}
                  </strong>
                </div>

                <div>
                  <span>Transporter email</span>
                  <strong>
                    {(selectedDetail ?? selectedDispute).transporter?.email ?? "—"}
                  </strong>
                </div>

                <div>
                  <span>Booking</span>
                  <strong>{selectedDispute.bookingId}</strong>
                </div>

                <div>
                  <span>Booking status</span>
                  <strong>
                    {label(selectedDispute.booking.status)}
                  </strong>
                </div>

                <div>
                  <span>Assigned administrator</span>
                  <strong>
                    {personName(selectedDispute.administrator)}
                  </strong>
                </div>

                <div>
                  <span>Created</span>
                  <strong>
                    {formatDate(selectedDispute.createdAt)}
                  </strong>
                </div>

                <div>
                  <span>Updated</span>
                  <strong>
                    {formatDate(selectedDispute.updatedAt)}
                  </strong>
                </div>
              </div>

              <div className="dispute-description">
                <span>Pickup details</span>
                <p>
                  <strong>Location:</strong>{" "}
                  {(selectedDetail ?? selectedDispute).evidence?.pickup?.location ??
                    (selectedDetail ?? selectedDispute).booking.pickupLocation ??
                    "—"}
                </p>
                <p>
                  <strong>Coordinates:</strong>{" "}
                  {(() => {
                    const pickup =
                      (selectedDetail ?? selectedDispute).evidence?.pickup;

                    const latitude =
                      pickup?.latitude ??
                      (selectedDetail ?? selectedDispute).booking.pickupLatitude;

                    const longitude =
                      pickup?.longitude ??
                      (selectedDetail ?? selectedDispute).booking.pickupLongitude;

                    return latitude != null && longitude != null
                      ? `${latitude}, ${longitude}`
                      : "—";
                  })()}
                </p>
                <p>
                  <strong>Scheduled:</strong>{" "}
                  {formatDate(
                    (selectedDetail ?? selectedDispute).evidence?.pickup
                      ?.scheduledDate ??
                      (selectedDetail ?? selectedDispute).booking.scheduledDate,
                  )}
                </p>
                <p>
                  <strong>Picked up:</strong>{" "}
                  {formatDate(
                    (selectedDetail ?? selectedDispute).evidence?.pickup
                      ?.pickedUpAt ??
                      (selectedDetail ?? selectedDispute).booking.pickedUpAt,
                  )}
                </p>
              </div>

              {((selectedDetail ?? selectedDispute).evidence?.media?.length ?? 0) > 0 && (
                <div className="dispute-description">
                  <span>Evidence</span>

                  <div className="dispute-evidence-grid">
                    {(selectedDetail ?? selectedDispute).evidence?.media?.map(
                      (media) => (
                        <div
                          className="dispute-evidence-item"
                          key={media.storagePath}
                        >
                          {media.type === "IMAGE" ? (
                            <img
                              src={media.signedUrl ?? ""}
                              alt={media.fileName}
                            />
                          ) : (
                            <video
                              src={media.signedUrl ?? undefined}
                              controls
                              preload="metadata"
                            />
                          )}

                          <span>
                            {media.type === "VIDEO" ? "Video" : "Photo"} —{" "}
                            {media.fileName}
                          </span>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              )}

              <div className="dispute-description">
                <span>Dispute reason</span>
                <p>{(selectedDetail ?? selectedDispute).reason}</p>
              </div>

              {selectedDispute.resolution && (
                <div className="dispute-description">
                  <span>Recorded resolution</span>
                  <p>{selectedDispute.resolution}</p>
                </div>
              )}

              </>
              )}

              {actionError && (
                <div className="dispute-action-error">
                  {actionError}
                </div>
              )}

              {selectedDispute.status !== "RESOLVED" &&
                selectedDispute.status !== "REJECTED" && (
                  <div className="dispute-actions">
                    <div>
                      <label htmlFor="dispute-administrator">
                        Assign administrator
                      </label>

                      <select
                        id="dispute-administrator"
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
                              ? "No dispute administrators available"
                              : "Select administrator"}
                        </option>

                        {administrators.map((administrator) => (
                          <option
                            key={administrator.userId}
                            value={administrator.userId}
                          >
                            {personName(administrator.user)} —{" "}
                            {label(
                              administrator.administratorType,
                            )}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="dispute-resolution">
                        Resolution / decision
                      </label>

                      <textarea
                        id="dispute-resolution"
                        value={resolution}
                        onChange={(event) =>
                          setResolution(event.target.value)
                        }
                        placeholder="Record the administrator's investigation outcome or final decision"
                        rows={5}
                        disabled={actionLoading}
                      />
                    </div>

                    <div className="dispute-status-actions">
                      {selectedDispute.status === "OPEN" && (
                        <button
                          type="button"
                          onClick={() =>
                            void handleStatus("INVESTIGATING")
                          }
                          disabled={actionLoading}
                        >
                          Start investigation
                        </button>
                      )}

                      {selectedDispute.status ===
                        "INVESTIGATING" && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              void handleStatus("RESOLVED")
                            }
                            disabled={
                              actionLoading ||
                              resolution.trim().length < 3
                            }
                          >
                            Resolve dispute
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              void handleStatus("REJECTED")
                            }
                            disabled={
                              actionLoading ||
                              resolution.trim().length < 3
                            }
                          >
                            Reject dispute
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
            </>
          )}
        </aside>
      </div>
    </section>
  );
}
