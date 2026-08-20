import { useEffect, useState } from "react";
import {
  listCustomers,
  type CustomerDirectoryItem,
} from "../api/customers";

type Props = {
  onSelectCustomer: (id: string) => void;
};

const statuses = ["ALL", "PENDING", "ACTIVE", "SUSPENDED", "BLOCKED"];

function statusClass(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

export default function CustomerDirectory({
  onSelectCustomer,
}: Props) {
  const [customers, setCustomers] = useState<CustomerDirectoryItem[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadCustomers() {
    try {
      setLoading(true);
      setError("");

      const result = await listCustomers({
        search: search.trim() || undefined,
        status: status === "ALL" ? undefined : status,
        page,
        limit: 25,
      });

      setCustomers(result.customers);
      setTotalPages(result.pagination.totalPages);
      setTotal(result.pagination.total);
    } catch {
      setError("Unable to load customer directory.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCustomers();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [search, status, page]);

  function changeStatus(value: string) {
    setStatus(value);
    setPage(1);
  }

  return (
    <section className="dashboard">
      <div className="module-header">
        <div>
          <div className="module-kicker">
            OPERATIONS / CUSTOMER MANAGEMENT
          </div>
          <h2>Customer Directory</h2>
          <p>
            Search, review and manage customer accounts across TransConet.
          </p>
        </div>

        <div className="customer-directory-count">
          {total.toLocaleString()} customers
        </div>
      </div>

      <div className="panel customer-directory-toolbar">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search name, email or phone…"
          aria-label="Search customers"
        />

        <div className="customer-status-filters">
          {statuses.map((item) => (
            <button
              key={item}
              type="button"
              className={status === item ? "customer-nav-active" : ""}
              onClick={() => changeStatus(item)}
            >
              {item}
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
            Loading customer directory…
          </div>
        ) : customers.length === 0 ? (
          <div className="customer-empty">
            <strong>No customers found.</strong>
            <span>
              Try changing the search term or customer status filter.
            </span>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Contact</th>
                  <th>Status</th>
                  <th>Bookings</th>
                  <th>Verification</th>
                  <th>Joined</th>
                  <th />
                </tr>
              </thead>

              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.id}>
                    <td>
                      <strong>
                        {customer.firstName} {customer.lastName}
                      </strong>
                      <span className="table-secondary">
                        {customer.id}
                      </span>
                    </td>

                    <td>
                      <strong>{customer.email || "—"}</strong>
                      <span className="table-secondary">
                        {customer.phone || "No phone"}
                      </span>
                    </td>

                    <td>
                      <span
                        className={`status-pill ${statusClass(
                          customer.status,
                        )}`}
                      >
                        {customer.status}
                      </span>
                    </td>

                    <td>
                      {customer.bookingCount ??
                        customer.customerProfile?.totalBookings ??
                        0}
                    </td>

                    <td>
                      {customer.customerProfile?.verificationStatus ||
                        "—"}
                    </td>

                    <td>{formatDate(customer.createdAt)}</td>

                    <td>
                      <button
                        type="button"
                        onClick={() => onSelectCustomer(customer.id)}
                      >
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
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
