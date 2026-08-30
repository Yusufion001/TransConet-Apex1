import { useState } from "react";
import TransporterDirectory from "./TransporterDirectory";
import {
  activateTransporter,
  blockTransporter,
  getTransporter,
  rejectTransporter,
  suspendTransporter,
  verifyTransporter,
  type Transporter,
} from "../api/transporters";

type TransporterPage =
  | "overview"
  | "profile"
  | "vehicles"
  | "bookings";

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function statusClass(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export default function Transporters() {
  const [transporterId, setTransporterId] = useState<string | null>(
    null,
  );
  const [transporter, setTransporter] =
    useState<Transporter | null>(null);
  const [page, setPage] =
    useState<TransporterPage>("overview");
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");

  async function openTransporter(id: string) {
    try {
      setLoading(true);
      setError("");
      setTransporterId(id);

      const data = await getTransporter(id);

      setTransporter(data);
      setPage("overview");
    } catch {
      setError("Unable to load transporter information.");
    } finally {
      setLoading(false);
    }
  }

  async function changeStatus(
    action: "activate" | "suspend" | "block",
  ) {
    if (!transporter) return;

    try {
      setActionLoading(true);
      setError("");

      const updated =
        action === "activate"
          ? await activateTransporter(transporter.id)
          : action === "suspend"
            ? await suspendTransporter(transporter.id)
            : await blockTransporter(transporter.id);

      setTransporter((current) =>
        current
          ? {
              ...current,
              ...updated,
            }
          : updated,
      );
    } catch {
      setError(`Unable to ${action} transporter.`);
    } finally {
      setActionLoading(false);
    }
  }

  async function changeVerification(
    action: "verify" | "reject",
  ) {
    if (!transporter) return;

    try {
      setActionLoading(true);
      setError("");

      const profile =
        action === "verify"
          ? await verifyTransporter(transporter.id)
          : await rejectTransporter(transporter.id);

      setTransporter((current) =>
        current
          ? {
              ...current,
              transporterProfile: profile,
            }
          : current,
      );
    } catch {
      setError(
        action === "verify"
          ? "Unable to approve transporter verification."
          : "Unable to reject transporter verification.",
      );
    } finally {
      setActionLoading(false);
    }
  }

  if (!transporterId || !transporter) {
    return (
      <section className="dashboard">
        <TransporterDirectory
          onSelectTransporter={openTransporter}
        />

        {loading && (
          <div className="panel customer-state">
            Loading transporter…
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

  const profile = transporter.transporterProfile;

  const pages: {
    key: TransporterPage;
    label: string;
  }[] = [
    { key: "overview", label: "Overview" },
    { key: "profile", label: "Profile" },
    { key: "vehicles", label: "Vehicles" },
    { key: "bookings", label: "Bookings" },
  ];

  return (
    <section className="dashboard">
      <div className="module-header">
        <div>
          <button
            type="button"
            className="customer-back-button"
            onClick={() => {
              setTransporterId(null);
              setTransporter(null);
              setError("");
            }}
          >
            ← Transporter Directory
          </button>

          <div className="module-kicker">
            OPERATIONS / TRANSPORTER MANAGEMENT
          </div>

          <h2>
            {transporter.firstName} {transporter.lastName}
          </h2>

          <p>
            {profile?.companyName ||
              transporter.email ||
              transporter.phone ||
              transporter.id}
          </p>
        </div>

        <span
          className={`status-pill ${statusClass(
            transporter.status,
          )}`}
        >
          {transporter.status}
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
              {transporter.firstName.charAt(0)}
              {transporter.lastName.charAt(0)}
            </div>

            <strong>
              {transporter.firstName}{" "}
              {transporter.lastName}
            </strong>

            <span>
              {transporter.email || "No email"}
            </span>

            <span>
              {transporter.phone || "No phone"}
            </span>
          </div>

          <div className="customer-navigation">
            {pages.map((item) => (
              <button
                key={item.key}
                type="button"
                className={
                  page === item.key
                    ? "customer-nav-active"
                    : ""
                }
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
              disabled={
                actionLoading ||
                transporter.status === "ACTIVE"
              }
              onClick={() =>
                void changeStatus("activate")
              }
            >
              Activate
            </button>

            <button
              type="button"
              disabled={
                actionLoading ||
                transporter.status === "SUSPENDED"
              }
              onClick={() =>
                void changeStatus("suspend")
              }
            >
              Suspend
            </button>

            <button
              type="button"
              disabled={
                actionLoading ||
                transporter.status === "BLOCKED"
              }
              onClick={() =>
                void changeStatus("block")
              }
            >
              Block
            </button>
          </div>

          <div className="customer-actions">
            <strong>Verification</strong>

            <button
              type="button"
              disabled={
                actionLoading ||
                profile?.verificationStatus ===
                  "APPROVED"
              }
              onClick={() =>
                void changeVerification("verify")
              }
            >
              Approve
            </button>

            <button
              type="button"
              disabled={
                actionLoading ||
                profile?.verificationStatus ===
                  "REJECTED"
              }
              onClick={() =>
                void changeVerification("reject")
              }
            >
              Reject
            </button>
          </div>
        </aside>

        <div className="customer-content">
          {page === "overview" && (
            <div className="customer-page">
              <div className="section-title">
                <h3>Transporter Overview</h3>
                <span>Account intelligence</span>
              </div>

              <div className="stats-grid customer-stats">
                <div className="stat-card">
                  <span>Total Trips</span>
                  <strong>
                    {profile?.totalTrips ??
                      transporter._count
                        ?.transporterBookings ??
                      0}
                  </strong>
                  <small>
                    Recorded transporter trips
                  </small>
                </div>

                <div className="stat-card">
                  <span>Rating</span>
                  <strong>
                    {profile?.rating ?? 0}
                  </strong>
                  <small>
                    Transporter profile rating
                  </small>
                </div>

                <div className="stat-card">
                  <span>Verification</span>
                  <strong>
                    {profile?.verificationStatus ??
                      "—"}
                  </strong>
                  <small>
                    Current verification state
                  </small>
                </div>

                <div className="stat-card">
                  <span>Vehicles</span>
                  <strong>
                    {transporter._count?.vehicles ??
                      transporter.vehicles?.length ??
                      0}
                  </strong>
                  <small>
                    Registered vehicles
                  </small>
                </div>
              </div>

              <div className="panel customer-detail-panel">
                <div className="panel-header">
                  <div>
                    <h2>Account Information</h2>
                    <p>
                      Transporter account record
                    </p>
                  </div>
                </div>

                <div className="detail-grid">
                  <div>
                    <span>Transporter ID</span>
                    <strong>
                      {transporter.id}
                    </strong>
                  </div>

                  <div>
                    <span>Name</span>
                    <strong>
                      {transporter.firstName}{" "}
                      {transporter.lastName}
                    </strong>
                  </div>

                  <div>
                    <span>Email</span>
                    <strong>
                      {transporter.email || "—"}
                    </strong>
                  </div>

                  <div>
                    <span>Phone</span>
                    <strong>
                      {transporter.phone || "—"}
                    </strong>
                  </div>

                  <div>
                    <span>Account Status</span>
                    <strong>
                      {transporter.status}
                    </strong>
                  </div>

                  <div>
                    <span>Transporter Tier</span>
                    <strong>
                      {transporter.transporterTier ||
                        "—"}
                    </strong>
                  </div>

                  <div>
                    <span>Last Login</span>
                    <strong>
                      {formatDate(
                        transporter.lastLoginAt,
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Joined</span>
                    <strong>
                      {formatDate(
                        transporter.createdAt,
                      )}
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {page === "profile" && (
            <div className="customer-page">
              <div className="section-title">
                <h3>Business Profile</h3>
                <span>
                  Transporter registration information
                </span>
              </div>

              <div className="panel customer-detail-panel">
                <div className="detail-grid">
                  <div>
                    <span>Company Name</span>
                    <strong>
                      {profile?.companyName || "—"}
                    </strong>
                  </div>

                  <div>
                    <span>Registration Number</span>
                    <strong>
                      {profile?.businessRegistrationNumber ||
                        "—"}
                    </strong>
                  </div>

                  <div>
                    <span>Address</span>
                    <strong>
                      {profile?.address || "—"}
                    </strong>
                  </div>

                  <div>
                    <span>City</span>
                    <strong>
                      {profile?.city || "—"}
                    </strong>
                  </div>

                  <div>
                    <span>State</span>
                    <strong>
                      {profile?.state || "—"}
                    </strong>
                  </div>

                  <div>
                    <span>Country</span>
                    <strong>
                      {profile?.country || "—"}
                    </strong>
                  </div>

                  <div>
                    <span>Verification</span>
                    <strong>
                      {profile?.verificationStatus ||
                        "—"}
                    </strong>
                  </div>

                  <div>
                    <span>Tier 2 Approved</span>
                    <strong>
                      {profile?.tier2Approved
                        ? "Yes"
                        : "No"}
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {page === "vehicles" && (
            <div className="customer-page">
              <div className="section-title">
                <h3>Registered Vehicles</h3>
                <span>
                  Vehicles associated with this transporter
                </span>
              </div>

              <div className="panel customer-directory-panel">
                {!transporter.vehicles?.length ? (
                  <div className="customer-empty">
                    <strong>
                      No vehicles recorded.
                    </strong>
                    <span>
                      There are no vehicle records
                      returned for this transporter.
                    </span>
                  </div>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Registration</th>
                          <th>Vehicle</th>
                          <th>Type</th>
                          <th>Class</th>
                          <th>Verification</th>
                          <th>Availability</th>
                        </tr>
                      </thead>

                      <tbody>
                        {transporter.vehicles.map(
                          (vehicle) => (
                            <tr key={vehicle.id}>
                              <td>
                                <strong>
                                  {
                                    vehicle.registrationNumber
                                  }
                                </strong>
                              </td>

                              <td>
                                {[
                                  vehicle.make,
                                  vehicle.model,
                                ]
                                  .filter(Boolean)
                                  .join(" ") ||
                                  "—"}
                              </td>

                              <td>
                                {vehicle.vehicleType}
                              </td>

                              <td>
                                {vehicle.vehicleClass}
                              </td>

                              <td>
                                {vehicle.verificationStatus}
                              </td>

                              <td>
                                {vehicle.availabilityStatus}
                              </td>
                            </tr>
                          ),
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {page === "bookings" && (
            <div className="customer-page">
              <div className="section-title">
                <h3>Recent Bookings</h3>
                <span>
                  Transporter booking activity returned by
                  the backend
                </span>
              </div>

              <div className="panel customer-directory-panel">
                {!transporter.transporterBookings
                  ?.length ? (
                  <div className="customer-empty">
                    <strong>
                      No bookings recorded.
                    </strong>
                    <span>
                      There are no booking records returned
                      for this transporter.
                    </span>
                  </div>
                ) : (
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
                        {transporter.transporterBookings.map(
                          (booking) => (
                            <tr key={booking.id}>
                              <td>
                                <strong>
                                  {booking.id}
                                </strong>
                              </td>

                              <td>
                                <strong>
                                  {booking.pickupLocation}
                                </strong>
                                <span className="table-secondary">
                                  →
                                </span>
                                <strong>
                                  {booking.destination}
                                </strong>
                              </td>

                              <td>
                                <span
                                  className={`status-pill ${statusClass(
                                    booking.status,
                                  )}`}
                                >
                                  {booking.status}
                                </span>
                              </td>

                              <td>
                                {booking.paymentStatus}
                              </td>

                              <td>
                                {booking.fare || "—"}
                              </td>

                              <td>
                                {formatDate(
                                  booking.createdAt,
                                )}
                              </td>
                            </tr>
                          ),
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
