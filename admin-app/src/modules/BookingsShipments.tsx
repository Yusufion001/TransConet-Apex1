import axios from "axios";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getAdminBooking, getBookingAssignmentOptions, assignAdminBooking,
  getAdminBookings,
  updateAdminBookingStatus,
  type Booking,
  type BookingDetail,
  type BookingStatus,
  type BookingAssignmentTransporter,
} from "../api/bookings-shipments";

const statuses: Array<BookingStatus | ""> = [
  "",
  "REQUESTED",
  "SEARCHING",
  "ASSIGNED",
  "ACCEPTED",
  "DRIVER_ARRIVING",
  "ARRIVED",
  "IN_TRANSIT",
  "COMPLETED",
  "CANCELLED",
  "DISPUTED",
];

const paymentStatuses = [
  "",
  "PENDING",
  "PROCESSING",
  "SUCCESS",
  "FAILED",
  "REFUNDED",
];

function labelize(value: string | null | undefined) {
  if (!value) return "—";

  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function statusClass(value: string | null | undefined) {
  return (value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
}

function money(value: string | null | undefined) {
  if (!value) return "—";

  const amount = Number(value);

  if (!Number.isFinite(amount)) return value;

  return `₦${amount.toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function dateTime(value: string | null | undefined) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString();
}

function personName(
  person:
    | {
        firstName: string;
        lastName: string;
      }
    | null
    | undefined,
) {
  if (!person) return "Unassigned";

  return `${person.firstName} ${person.lastName}`.trim();
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="detail-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default function BookingsShipments() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selected, setSelected] = useState<BookingDetail | null>(null);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");

  const [updating, setUpdating] = useState(false);
  const [assignmentOptions, setAssignmentOptions] = useState<BookingAssignmentTransporter[]>([]);
  const [selectedTransporterId, setSelectedTransporterId] = useState("");
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [assignmentLoading, setAssignmentLoading] = useState(false);


  const loadBookings = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const result = await getAdminBookings({
        search: search.trim() || undefined,
        status: status || undefined,
        paymentStatus: paymentStatus || undefined,
        page,
        limit: 15,
      });

      setBookings(result.items ?? []);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const serverError = err.response?.data?.error;
        setError(
          typeof serverError === "string"
            ? serverError
            : err.message || "Unable to load bookings and shipments.",
        );
      } else {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load bookings and shipments.",
        );
      }
    } finally {
      setLoading(false);
    }
  }, [search, status, paymentStatus, page]);

  useEffect(() => {
    void loadBookings();
  }, [loadBookings]);

  async function openBooking(id: string) {
    try {
      setDetailLoading(true);
      setError("");

      const detail = await getAdminBooking(id);
      setSelected(detail);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load booking details.",
      );
    } finally {
      setDetailLoading(false);
    }
  }

  async function loadAssignmentOptions() {
    try {
      setAssignmentLoading(true);

      const options = await getBookingAssignmentOptions();
      setAssignmentOptions(options);

      const currentTransporterId = selected?.transporterId ?? "";
      const currentVehicleId = selected?.vehicleId ?? "";

      setSelectedTransporterId(currentTransporterId);
      setSelectedVehicleId(currentVehicleId);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load transporter and vehicle options.",
      );
    } finally {
      setAssignmentLoading(false);
    }
  }

  async function assignBooking() {
    if (!selected || !selectedTransporterId || !selectedVehicleId) {
      setError("Select both a transporter and a vehicle.");
      return;
    }

    try {
      setAssignmentLoading(true);
      setError("");

      const updated = await assignAdminBooking(
        selected.id,
        selectedTransporterId,
        selectedVehicleId,
      );

      const refreshed = await getAdminBooking(selected.id);
      setSelected(refreshed ?? { ...selected, ...updated });

      await loadBookings();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to assign transporter and vehicle.",
      );
    } finally {
      setAssignmentLoading(false);
    }
  }

  async function changeStatus(nextStatus: BookingStatus) {
    if (!selected) return;

    try {
      setUpdating(true);
      setError("");

      const updated = await updateAdminBookingStatus(
        selected.id,
        nextStatus,
      );

      setSelected({
        ...selected,
        ...updated,
      });

      await loadBookings();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update booking status.",
      );
    } finally {
      setUpdating(false);
    }
  }

  const summary = useMemo(() => {
    const count = (value: BookingStatus) =>
      bookings.filter((booking) => booking.status === value).length;

    return {
      visible: bookings.length,
      requested: count("REQUESTED"),
      assigned: count("ASSIGNED"),
      accepted: count("ACCEPTED"),
      inTransit: count("IN_TRANSIT"),
      completed: count("COMPLETED"),
      disputed: count("DISPUTED"),
      cancelled: count("CANCELLED"),
    };
  }, [bookings]);

  if (selected) {
    return (
      <div className="dashboard">
        <section className="module-header">
          <div>
            <button
              type="button"
              className="customer-back-button"
              onClick={() => setSelected(null)}
            >
              ← Bookings & Shipments
            </button>

            <div className="module-kicker">
              OPERATIONS / BOOKING INTELLIGENCE
            </div>

            <h2>
              {selected.pickupLocation} → {selected.destination}
            </h2>

            <p>
              Booking {selected.id}
            </p>
          </div>

          <span
            className={`status-pill ${statusClass(selected.status)}`}
          >
            {labelize(selected.status)}
          </span>
        </section>

        {error && (
          <div className="panel customer-state error-state">
            {error}
          </div>
        )}

        {detailLoading ? (
          <div className="panel customer-state">
            Loading booking details…
          </div>
        ) : (
          <>
            <section className="stats-grid">
              <div className="stat-card">
                <span>Fare</span>
                <strong>{money(selected.fare)}</strong>
              </div>

              <div className="stat-card">
                <span>Payment</span>
                <strong>{labelize(selected.paymentStatus)}</strong>
              </div>

              <div className="stat-card">
                <span>Customer</span>
                <strong>{personName(selected.customer)}</strong>
              </div>

              <div className="stat-card">
                <span>Transporter</span>
                <strong>{personName(selected.transporter)}</strong>
              </div>
            </section>

            <section className="customer-layout">
              <aside className="customer-subnav panel">
                <div className="customer-actions">
                  <strong>Lifecycle Control</strong>

                  <select
                    value={selected.status}
                    disabled={updating}
                    onChange={(event) =>
                      void changeStatus(
                        event.target.value as BookingStatus,
                      )
                    }
                  >
                    {statuses
                      .filter(Boolean)
                      .map((item) => (
                        <option key={item} value={item}>
                          {labelize(item)}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="customer-actions">
                  <strong>Transporter & Vehicle Assignment</strong>

                  <select
                    value={selectedTransporterId}
                    disabled={assignmentLoading}
                    onFocus={() => {
                      if (!assignmentOptions.length) {
                        void loadAssignmentOptions();
                      }
                    }}
                    onChange={(event) => {
                      setSelectedTransporterId(event.target.value);
                      setSelectedVehicleId("");
                    }}
                  >
                    <option value="">Select transporter</option>
                    {assignmentOptions.map((transporter) => (
                      <option key={transporter.id} value={transporter.id}>
                        {transporter.firstName} {transporter.lastName}
                      </option>
                    ))}
                  </select>

                  <select
                    value={selectedVehicleId}
                    disabled={
                      assignmentLoading || !selectedTransporterId
                    }
                    onChange={(event) =>
                      setSelectedVehicleId(event.target.value)
                    }
                  >
                    <option value="">Select vehicle</option>
                    {(
                      assignmentOptions.find(
                        (transporter) =>
                          transporter.id === selectedTransporterId,
                      )?.vehicles ?? []
                    ).map((vehicle) => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {vehicle.registrationNumber} ·{" "}
                        {vehicle.vehicleType}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    disabled={
                      assignmentLoading ||
                      !selectedTransporterId ||
                      !selectedVehicleId
                    }
                    onClick={() => void assignBooking()}
                  >
                    {assignmentLoading ? "Assigning…" : "Assign Booking"}
                  </button>
                </div>

                <div className="customer-actions">
                  <strong>Operational References</strong>
                  <span>Events: {selected.events?.length ?? 0}</span>
                  <span>
                    Payments: {selected.payments?.length ?? 0}
                  </span>
                  <span>
                    Disputes: {selected.disputes?.length ?? 0}
                  </span>
                  <span>
                    Support: {selected.supportTickets?.length ?? 0}
                  </span>
                </div>
              </aside>

              <div className="customer-content">
                <section className="panel">
                  <div className="panel-header">
                    <div>
                      <h3>Booking Information</h3>
                      <p>Authoritative operational booking record</p>
                    </div>
                  </div>

                  <div className="detail-grid">
                    <DetailRow label="Booking ID" value={selected.id} />
                    <DetailRow
                      label="Status"
                      value={labelize(selected.status)}
                    />
                    <DetailRow
                      label="Payment Status"
                      value={labelize(selected.paymentStatus)}
                    />
                    <DetailRow
                      label="Fare"
                      value={money(selected.fare)}
                    />
                    <DetailRow
                      label="Estimated Fare"
                      value={money(selected.estimatedFare)}
                    />
                    <DetailRow
                      label="Cargo Category"
                      value={labelize(selected.cargoCategory)}
                    />
                    <DetailRow
                      label="Cargo Weight"
                      value={selected.cargoWeight ?? "—"}
                    />
                    <DetailRow
                      label="Truck Category"
                      value={labelize(selected.truckCategory)}
                    />
                    <DetailRow
                      label="Scheduled Date"
                      value={dateTime(selected.scheduledDate)}
                    />
                    <DetailRow
                      label="Created"
                      value={dateTime(selected.createdAt)}
                    />
                    <DetailRow
                      label="Updated"
                      value={dateTime(selected.updatedAt)}
                    />
                  </div>
                </section>

                <section className="panel">
                  <div className="panel-header">
                    <div>
                      <h3>Participants & Vehicle</h3>
                      <p>Current operational assignments</p>
                    </div>
                  </div>

                  <div className="detail-grid">
                    <DetailRow
                      label="Customer"
                      value={personName(selected.customer)}
                    />
                    <DetailRow
                      label="Customer Email"
                      value={selected.customer?.email ?? "—"}
                    />
                    <DetailRow
                      label="Customer Phone"
                      value={selected.customer?.phone ?? "—"}
                    />
                    <DetailRow
                      label="Transporter"
                      value={personName(selected.transporter)}
                    />
                    <DetailRow
                      label="Transporter Tier"
                      value={labelize(
                        selected.transporter?.transporterTier,
                      )}
                    />
                    <DetailRow
                      label="Vehicle"
                      value={
                        selected.vehicle?.registrationNumber ?? "Unassigned"
                      }
                    />
                    <DetailRow
                      label="Vehicle Type"
                      value={selected.vehicle?.vehicleType ?? "—"}
                    />
                    <DetailRow
                      label="Vehicle Class"
                      value={selected.vehicle?.vehicleClass ?? "—"}
                    />
                  </div>
                </section>

                <section className="panel">
                  <div className="panel-header">
                    <div>
                      <h3>Route & Cargo</h3>
                      <p>Shipment movement information</p>
                    </div>
                  </div>

                  <div className="detail-grid">
                    <DetailRow
                      label="Pickup"
                      value={selected.pickupLocation}
                    />
                    <DetailRow
                      label="Destination"
                      value={selected.destination}
                    />
                    <DetailRow
                      label="Cargo Description"
                      value={selected.cargoDescription ?? "—"}
                    />
                    <DetailRow
                      label="Pickup Coordinates"
                      value={`${selected.pickupLatitude ?? "—"}, ${
                        selected.pickupLongitude ?? "—"
                      }`}
                    />
                    <DetailRow
                      label="Destination Coordinates"
                      value={`${selected.destinationLatitude ?? "—"}, ${
                        selected.destinationLongitude ?? "—"
                      }`}
                    />
                  </div>
                </section>

                <section className="panel">
                  <div className="panel-header">
                    <div>
                      <h3>Lifecycle Timeline</h3>
                      <p>Booking status timestamps</p>
                    </div>
                  </div>

                  <div className="detail-grid">
                    <DetailRow
                      label="Accepted"
                      value={dateTime(selected.acceptedAt)}
                    />
                    <DetailRow
                      label="Driver Arrived"
                      value={dateTime(selected.arrivedAt)}
                    />
                    <DetailRow
                      label="Picked Up"
                      value={dateTime(selected.pickedUpAt)}
                    />
                    <DetailRow
                      label="In Transit"
                      value={dateTime(selected.inTransitAt)}
                    />
                    <DetailRow
                      label="Delivered"
                      value={dateTime(selected.deliveredAt)}
                    />
                    <DetailRow
                      label="Completed"
                      value={dateTime(selected.completedAt)}
                    />
                  </div>
                </section>

                <section className="panel">
                  <div className="panel-header">
                    <div>
                      <h3>Payments</h3>
                      <p>Payment records associated with this booking</p>
                    </div>
                  </div>

                  {!selected.payments?.length ? (
                    <div className="empty-activity">
                      No payment records returned for this booking.
                    </div>
                  ) : (
                    selected.payments.map((payment) => (
                      <div className="detail-grid" key={payment.id}>
                        <DetailRow
                          label="Amount"
                          value={money(payment.amount)}
                        />
                        <DetailRow
                          label="Currency"
                          value={payment.currency}
                        />
                        <DetailRow
                          label="Provider"
                          value={payment.provider}
                        />
                        <DetailRow
                          label="Status"
                          value={labelize(payment.status)}
                        />
                        <DetailRow
                          label="Reference"
                          value={payment.transactionReference}
                        />
                        <DetailRow
                          label="Created"
                          value={dateTime(payment.createdAt)}
                        />
                      </div>
                    ))
                  )}
                </section>

                <section className="panel">
                  <div className="panel-header">
                    <div>
                      <h3>Disputes & Support</h3>
                      <p>Related customer-care records</p>
                    </div>
                  </div>

                  <div className="detail-grid">
                    <DetailRow
                      label="Disputes"
                      value={selected.disputes?.length ?? 0}
                    />
                    <DetailRow
                      label="Support Tickets"
                      value={selected.supportTickets?.length ?? 0}
                    />
                  </div>
                </section>

                <section className="panel">
                  <div className="panel-header">
                    <div>
                      <h3>Shipment Events</h3>
                      <p>Events returned by the booking event service</p>
                    </div>
                  </div>

                  {!selected.events?.length ? (
                    <div className="empty-activity">
                      No shipment events returned for this booking.
                    </div>
                  ) : (
                    <div className="activity-list">
                      {selected.events.map((event) => (
                        <div className="activity-item" key={event.id}>
                          <strong>
                            {labelize(event.type ?? event.eventType)}
                          </strong>
                          <span>
                            {dateTime(
                              event.createdAt ?? event.occurredAt,
                            )}
                          </span>
                          {event.description && (
                            <p>{event.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </section>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="dashboard">
      <section className="module-header">
        <div>
          <div className="module-kicker">TRANSCONET-APEX1 / OPERATIONS</div>
          <h2>Bookings & Shipments</h2>
          <p>
            Manage bookings and shipment lifecycles using authorized
            operational data.
          </p>
        </div>
      </section>

      {error && (
        <div className="panel customer-state error-state">
          {error}
        </div>
      )}

      <section className="stats-grid">
        <div className="stat-card">
          <span>Bookings in View</span>
          <strong>{summary.visible}</strong>
          <small>{total} total matching records</small>
        </div>

        <div className="stat-card">
          <span>Requested</span>
          <strong>{summary.requested}</strong>
        </div>

        <div className="stat-card">
          <span>Assigned</span>
          <strong>{summary.assigned}</strong>
        </div>

        <div className="stat-card">
          <span>In Transit</span>
          <strong>{summary.inTransit}</strong>
        </div>

        <div className="stat-card">
          <span>Completed</span>
          <strong>{summary.completed}</strong>
        </div>

        <div className="stat-card">
          <span>Disputed</span>
          <strong>{summary.disputed}</strong>
        </div>

        <div className="stat-card">
          <span>Cancelled</span>
          <strong>{summary.cancelled}</strong>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h3>Booking Operations</h3>
            <p>
              Search, filter and inspect authoritative booking records.
            </p>
          </div>
        </div>

        <div className="filters">
          <input
            value={search}
            placeholder="Search booking, customer, transporter, vehicle, route…"
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />

          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            {statuses.map((item) => (
              <option key={item || "all"} value={item}>
                {item ? labelize(item) : "All booking statuses"}
              </option>
            ))}
          </select>

          <select
            value={paymentStatus}
            onChange={(event) => {
              setPaymentStatus(event.target.value);
              setPage(1);
            }}
          >
            {paymentStatuses.map((item) => (
              <option key={item || "all"} value={item}>
                {item ? labelize(item) : "All payment statuses"}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="empty-activity">
            Loading authorized booking data…
          </div>
        ) : !bookings.length ? (
          <div className="empty-activity">
            <strong>No bookings found</strong>
            <span>
              No operational records match the current filters.
            </span>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Booking</th>
                  <th>Customer</th>
                  <th>Transporter</th>
                  <th>Route</th>
                  <th>Vehicle</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th>Fare</th>
                  <th>Created</th>
                </tr>
              </thead>

              <tbody>
                {bookings.map((booking) => (
                  <tr
                    key={booking.id}
                    onClick={() => void openBooking(booking.id)}
                    className="clickable-row"
                  >
                    <td>
                      <strong>{booking.id.slice(0, 8)}</strong>
                    </td>

                    <td>{personName(booking.customer)}</td>

                    <td>{personName(booking.transporter)}</td>

                    <td>
                      <div>
                        <strong>{booking.pickupLocation}</strong>
                        <span> → {booking.destination}</span>
                      </div>
                    </td>

                    <td>
                      {booking.vehicle?.registrationNumber ?? "Unassigned"}
                    </td>

                    <td>
                      <span
                        className={`status-pill ${statusClass(
                          booking.status,
                        )}`}
                      >
                        {labelize(booking.status)}
                      </span>
                    </td>

                    <td>{labelize(booking.paymentStatus)}</td>

                    <td>{money(booking.fare)}</td>

                    <td>{dateTime(booking.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="pagination">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((value) => value - 1)}
          >
            Previous
          </button>

          <span>
            Page {page} of {Math.max(totalPages, 1)}
          </span>

          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((value) => value + 1)}
          >
            Next
          </button>
        </div>
      </section>
    </div>
  );
}
