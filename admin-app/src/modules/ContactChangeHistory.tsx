import type { AdminContactChange } from "../types/contact-change";

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function statusClass(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function maskContact(type: AdminContactChange["type"], value: string) {
  if (!value) return "—";

  if (type === "PHONE") {
    const compact = value.replace(/\s+/g, "");
    if (compact.length <= 6) return "••••";
    return `${compact.slice(0, 4)}••••${compact.slice(-3)}`;
  }

  const at = value.indexOf("@");
  if (at <= 0) return "••••";
  return `${value.slice(0, 1)}•••${value.slice(at)}`;
}

function verificationState(
  timestamp: string | null,
  pending: boolean,
) {
  if (timestamp) return `✓ Verified · ${formatDate(timestamp)}`;
  if (pending) return "● Pending";
  return "Not recorded";
}

export default function ContactChangeHistory({
  changes,
}: {
  changes: AdminContactChange[];
}) {
  return (
    <div className="customer-page">
      <div className="section-title">
        <div>
          <h3>Contact Change History</h3>
          <span>Read-only security workflow history</span>
        </div>
      </div>

      <div className="panel customer-detail-panel">
        <div className="customer-empty" style={{ marginBottom: 18 }}>
          <strong>Secure contact workflow</strong>
          <span>
            Contact changes are completed through identity and contact
            verification. Administration does not bypass that workflow.
          </span>
        </div>

        {!changes.length ? (
          <div className="customer-empty">
            <strong>No contact changes recorded.</strong>
            <span>
              No email or phone change requests have been recorded for this
              account.
            </span>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Current</th>
                  <th>Requested</th>
                  <th>Status</th>
                  <th>Liveness</th>
                  <th>Contact Verification</th>
                  <th>Created</th>
                  <th>Expires</th>
                  <th>Completed</th>
                  <th>Attempts</th>
                </tr>
              </thead>

              <tbody>
                {changes.map((change) => (
                  <tr key={change.id}>
                    <td>
                      <strong>{change.type}</strong>
                    </td>

                    <td>
                      {maskContact(change.type, change.currentValue)}
                    </td>

                    <td>
                      {maskContact(change.type, change.requestedValue)}
                    </td>

                    <td>
                      <span
                        className={`status-pill ${statusClass(change.status)}`}
                      >
                        {change.status}
                      </span>
                    </td>

                    <td>
                      {verificationState(
                        change.livenessVerifiedAt,
                        change.status === "PENDING_LIVENESS",
                      )}
                    </td>

                    <td>
                      {verificationState(
                        change.contactVerifiedAt,
                        change.status === "PENDING_CONTACT_VERIFICATION",
                      )}
                    </td>

                    <td>{formatDate(change.createdAt)}</td>
                    <td>{formatDate(change.expiresAt)}</td>
                    <td>{formatDate(change.completedAt)}</td>
                    <td>{change.contactVerificationAttempts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
