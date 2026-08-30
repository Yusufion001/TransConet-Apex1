import { useCallback, useEffect, useState } from "react";
import {
  listTransporters,
  type Transporter,
} from "../api/transporters";

type Props = {
  onSelectTransporter: (id: string) => void;
};

const statuses = [
  "ALL",
  "PENDING",
  "ACTIVE",
  "SUSPENDED",
  "BLOCKED",
];

const verificationStatuses = [
  "ALL",
  "PENDING",
  "APPROVED",
  "REJECTED",
];

function statusClass(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

export default function TransporterDirectory({
  onSelectTransporter,
}: Props) {
  const [transporters, setTransporters] = useState<Transporter[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [verificationStatus, setVerificationStatus] = useState("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadTransporters = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const result = await listTransporters({
        search: search.trim() || undefined,
        status: status === "ALL" ? undefined : status,
        verificationStatus:
          verificationStatus === "ALL"
            ? undefined
            : verificationStatus,
        page,
        limit: 25,
      });

      setTransporters(result.transporters);
      setTotalPages(result.pagination.totalPages);
      setTotal(result.pagination.total);
    } catch {
      setError("Unable to load transporter directory.");
    } finally {
      setLoading(false);
    }
  }, [search, status, verificationStatus, page]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadTransporters();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [loadTransporters]);

  function changeStatus(value: string) {
    setStatus(value);
    setPage(1);
  }

  function changeVerificationStatus(value: string) {
    setVerificationStatus(value);
    setPage(1);
  }

  return (
    <section className="dashboard">
      <div className="module-header">
        <div>
          <div className="module-kicker">
            OPERATIONS / TRANSPORTER MANAGEMENT
          </div>

          <h2>Transporter Directory</h2>

          <p>
            Search, review and manage transporter accounts across
            TransConet.
          </p>
        </div>

        <div className="customer-directory-count">
          {total.toLocaleString()} transporters
        </div>
      </div>

      <div className="panel customer-directory-toolbar">
        <input
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          placeholder="Search name, company, email or phone…"
          aria-label="Search transporters"
        />

        <div className="customer-status-filters">
          {statuses.map((item) => (
            <button
              key={item}
              type="button"
              className={
                status === item ? "customer-nav-active" : ""
              }
              onClick={() => changeStatus(item)}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="customer-status-filters">
          {verificationStatuses.map((item) => (
            <button
              key={item}
              type="button"
              className={
                verificationStatus === item
                  ? "customer-nav-active"
                  : ""
              }
              onClick={() => changeVerificationStatus(item)}
            >
              Verification: {item}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="panel error-state">
          {error}
        </div>
      )}

      <div className="panel customer-directory-panel">
        {loading ? (
          <div className="customer-state">
            Loading transporter directory…
          </div>
        ) : transporters.length === 0 ? (
          <div className="customer-empty">
            <strong>No transporters found.</strong>
            <span>
              Try changing the search term or transporter filters.
            </span>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Transporter</th>
                  <th>Company</th>
                  <th>Contact</th>
                  <th>Status</th>
                  <th>Verification</th>
                  <th>Trips</th>
                  <th>Rating</th>
                  <th>Joined</th>
                  <th />
                </tr>
              </thead>

              <tbody>
                {transporters.map((transporter) => {
                  const profile =
                    transporter.transporterProfile;

                  return (
                    <tr key={transporter.id}>
                      <td>
                        <strong>
                          {transporter.firstName}{" "}
                          {transporter.lastName}
                        </strong>

                        <span className="table-secondary">
                          {transporter.id}
                        </span>
                      </td>

                      <td>
                        <strong>
                          {profile?.companyName || "Individual transporter"}
                        </strong>

                        <span className="table-secondary">
                          {profile?.city || profile?.state || "—"}
                        </span>
                      </td>

                      <td>
                        <strong>
                          {transporter.email || "—"}
                        </strong>

                        <span className="table-secondary">
                          {transporter.phone || "No phone"}
                        </span>
                      </td>

                      <td>
                        <span
                          className={`status-pill ${statusClass(
                            transporter.status,
                          )}`}
                        >
                          {transporter.status}
                        </span>
                      </td>

                      <td>
                        <span
                          className={`status-pill ${statusClass(
                            profile?.verificationStatus || "UNKNOWN",
                          )}`}
                        >
                          {profile?.verificationStatus || "—"}
                        </span>
                      </td>

                      <td>
                        {profile?.totalTrips ??
                          transporter._count?.transporterBookings ??
                          0}
                      </td>

                      <td>
                        {profile?.rating ?? 0}
                      </td>

                      <td>
                        {formatDate(transporter.createdAt)}
                      </td>

                      <td>
                        <button
                          type="button"
                          onClick={() =>
                            onSelectTransporter(transporter.id)
                          }
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="customer-pagination">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((value) => value - 1)}
          >
            Previous
          </button>

          <span>
            Page {page} of {totalPages}
          </span>

          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((value) => value + 1)}
          >
            Next
          </button>
        </div>
      )}
    </section>
  );
}
