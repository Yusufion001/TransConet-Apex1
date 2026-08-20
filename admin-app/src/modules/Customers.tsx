import { useState } from "react";
import CustomerDirectory from "./CustomerDirectory";
import {
  activateCustomer,
  blockCustomer,
  getCustomer,
  getCustomerBookings,
  suspendCustomer,
  type Booking,
  type Customer,
} from "../api/customers";

type CustomerPage =
  | "overview"
  | "profile"
  | "bookings"
  | "shipments"
  | "payments"
  | "support"
  | "disputes";

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function statusClass(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export default function Customers() {
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [page, setPage] = useState<CustomerPage>("overview");
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");

  async function openCustomer(id: string) {
    try {
      setLoading(true);
      setError("");
      setCustomerId(id);

      const [customerData, bookingData] = await Promise.all([
        getCustomer(id),
        getCustomerBookings(id),
      ]);

      setCustomer(customerData);
      setBookings(bookingData);
      setPage("overview");
    } catch {
      setError("Unable to load customer information.");
    } finally {
      setLoading(false);
    }
  }

  async function changeStatus(
    action: "activate" | "suspend" | "block",
  ) {
    if (!customer) return;

    try {
      setActionLoading(true);
      setError("");

      const updated =
        action === "activate"
          ? await activateCustomer(customer.id)
          : action === "suspend"
            ? await suspendCustomer(customer.id)
            : await blockCustomer(customer.id);

      setCustomer((current) =>
        current
          ? {
              ...current,
              ...updated,
            }
          : updated,
      );
    } catch {
      setError(`Unable to ${action} customer.`);
    } finally {
      setActionLoading(false);
    }
  }

  if (!customerId || !customer) {
    return (
      <section className="dashboard">
        <CustomerDirectory onSelectCustomer={openCustomer} />

        {loading && (
          <div className="panel customer-state">
            Loading customer…
          </div>
        )}

        {error && (
          <div className="panel customer-state error-state">
            {error}
          </div>
        )}
      </section>
    );
  }

  const profile = customer.customerProfile;

  const pages: { key: CustomerPage; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "profile", label: "Profile" },
    { key: "bookings", label: "Bookings" },
    { key: "shipments", label: "Shipments" },
    { key: "payments", label: "Payments" },
    { key: "support", label: "Support" },
    { key: "disputes", label: "Disputes" },
  ];

  return (
    <section className="dashboard">
      <div className="module-header">
        <div>
          <button
            type="button"
            className="customer-back-button"
            onClick={() => {
              setCustomerId(null);
              setCustomer(null);
              setBookings([]);
              setError("");
            }}
          >
            ← Customer Directory
          </button>

          <div className="module-kicker">
            OPERATIONS / CUSTOMER MANAGEMENT
          </div>

          <h2>
            {customer.firstName} {customer.lastName}
          </h2>

          <p>{customer.email || customer.phone || customer.id}</p>
        </div>

        <span className={`status-pill ${statusClass(customer.status)}`}>
          {customer.status}
        </span>
      </div>

      {error && (
        <div className="panel customer-state error-state">
          {error}
        </div>
      )}

      <div className="customer-layout">
        <aside className="customer-subnav panel">
          <div className="customer-identity">
            <div className="customer-avatar">
              {customer.firstName.charAt(0)}
              {customer.lastName.charAt(0)}
            </div>

            <strong>
              {customer.firstName} {customer.lastName}
            </strong>

            <span>{customer.email || "No email"}</span>
            <span>{customer.phone || "No phone"}</span>
          </div>

          <div className="customer-navigation">
            {pages.map((item) => (
              <button
                key={item.key}
                type="button"
                className={page === item.key ? "customer-nav-active" : ""}
                onClick={() => setPage(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="customer-actions">
            <strong>Account Actions</strong>

            <button
              type="button"
              disabled={actionLoading || customer.status === "ACTIVE"}
              onClick={() => void changeStatus("activate")}
            >
              Activate
            </button>

            <button
              type="button"
              disabled={
                actionLoading || customer.status === "SUSPENDED"
              }
              onClick={() => void changeStatus("suspend")}
            >
              Suspend
            </button>

            <button
              type="button"
              disabled={actionLoading || customer.status === "BLOCKED"}
              onClick={() => void changeStatus("block")}
            >
              Block
            </button>
          </div>
        </aside>

        <div className="customer-content">
          {page === "overview" && (
            <div className="customer-page">
              <div className="section-title">
                <h3>Customer Overview</h3>
                <span>Account intelligence</span>
              </div>

              <div className="stats-grid customer-stats">
                <div className="stat-card">
                  <span>Total Bookings</span>
                  <strong>
                    {customer._count?.customerBookings ??
                      profile?.totalBookings ??
                      bookings.length}
                  </strong>
                  <small>Customer booking activity</small>
                </div>

                <div className="stat-card">
                  <span>Rating</span>
                  <strong>{profile?.rating ?? 0}</strong>
                  <small>Customer profile rating</small>
                </div>

                <div className="stat-card">
                  <span>Verification</span>
                  <strong>
                    {profile?.verificationStatus ?? "—"}
                  </strong>
                  <small>Verification state</small>
                </div>

                <div className="stat-card">
                  <span>Last Login</span>
                  <strong>
                    {formatDate(customer.lastLoginAt)}
                  </strong>
                  <small>Account activity</small>
                </div>
              </div>

              <div className="panel customer-detail-panel">
                <div className="panel-header">
                  <div>
                    <h2>Account Information</h2>
                    <p>Customer record</p>
                  </div>
                </div>

                <div className="detail-grid">
                  <div>
                    <span>Customer ID</span>
                    <strong>{customer.id}</strong>
                  </div>

                  <div>
                    <span>Name</span>
                    <strong>
                      {customer.firstName} {customer.lastName}
                    </strong>
                  </div>

                  <div>
                    <span>Email</span>
                    <strong>{customer.email || "—"}</strong>
                  </div>

                  <div>
                    <span>Phone</span>
                    <strong>{customer.phone || "—"}</strong>
                  </div>

                  <div>
                    <span>Status</span>
                    <strong>{customer.status}</strong>
                  </div>

                  <div>
                    <span>Created</span>
                    <strong>{formatDate(customer.createdAt)}</strong>
                  </div>

                  <div>
                    <span>City</span>
                    <strong>{profile?.city || "—"}</strong>
                  </div>

                  <div>
                    <span>State</span>
                    <strong>{profile?.state || "—"}</strong>
                  </div>

                  <div>
                    <span>Country</span>
                    <strong>{profile?.country || "—"}</strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {page === "profile" && (
            <CustomerDataPage title="Customer Profile">
              <div className="detail-grid">
                <div><span>Customer ID</span><strong>{customer.id}</strong></div>
                <div><span>First Name</span><strong>{customer.firstName}</strong></div>
                <div><span>Last Name</span><strong>{customer.lastName}</strong></div>
                <div><span>Email</span><strong>{customer.email || "—"}</strong></div>
                <div><span>Phone</span><strong>{customer.phone || "—"}</strong></div>
                <div><span>Role</span><strong>{customer.role}</strong></div>
                <div><span>Status</span><strong>{customer.status}</strong></div>
                <div><span>Verification</span><strong>{profile?.verificationStatus || "—"}</strong></div>
                <div><span>City</span><strong>{profile?.city || "—"}</strong></div>
                <div><span>State</span><strong>{profile?.state || "—"}</strong></div>
                <div><span>Country</span><strong>{profile?.country || "—"}</strong></div>
                <div><span>Updated</span><strong>{formatDate(customer.updatedAt)}</strong></div>
              </div>
            </CustomerDataPage>
          )}

          {page === "bookings" || page === "shipments" ? (
            <CustomerDataPage
              title={page === "bookings" ? "Booking History" : "Shipment History"}
            >
              <BookingTable bookings={bookings} />
            </CustomerDataPage>
          ) : null}

          {page === "payments" && (
            <CustomerDataPage title="Payment History">
              <div className="customer-empty">
                <strong>Payment operations remain governed by the payment domain.</strong>
                <span>
                  Customer payment history will be connected when the
                  administrator payment-history endpoint is exposed.
                </span>
              </div>
            </CustomerDataPage>
          )}

          {page === "support" && (
            <CustomerDataPage title="Support Activity">
              <div className="customer-empty">
                <strong>Support activity</strong>
                <span>
                  Customer support activity will connect to the administrator
                  support history endpoint.
                </span>
              </div>
            </CustomerDataPage>
          )}

          {page === "disputes" && (
            <CustomerDataPage title="Disputes">
              <div className="customer-empty">
                <strong>Customer disputes</strong>
                <span>
                  Dispute management remains governed by the existing dispute
                  domain.
                </span>
              </div>
            </CustomerDataPage>
          )}
        </div>
      </div>
    </section>
  );
}

function CustomerDataPage({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="customer-page">
      <div className="section-title">
        <h3>{title}</h3>
        <span>Customer Management</span>
      </div>

      <div className="panel customer-detail-panel">
        {children}
      </div>
    </div>
  );
}

function BookingTable({ bookings }: { bookings: Booking[] }) {
  if (!bookings.length) {
    return (
      <div className="customer-empty">
        <strong>No booking records returned.</strong>
        <span>No booking records were returned for this customer.</span>
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Booking</th>
            <th>Route</th>
            <th>Status</th>
            <th>Payment</th>
            <th>Fare</th>
            <th>Created</th>
          </tr>
        </thead>

        <tbody>
          {bookings.map((booking) => (
            <tr key={booking.id}>
              <td>{booking.id}</td>

              <td>
                <strong>{booking.pickupLocation}</strong>
                <span className="table-secondary">
                  → {booking.destination}
                </span>
              </td>

              <td>
                <span className={`status-pill ${statusClass(booking.status)}`}>
                  {booking.status}
                </span>
              </td>

              <td>{booking.paymentStatus}</td>
              <td>{booking.fare || booking.estimatedFare || "—"}</td>
              <td>{formatDate(booking.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
