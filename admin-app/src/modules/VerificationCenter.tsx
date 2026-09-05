import axios from "axios";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  approveVerificationDocument,
  getPendingVerificationDocuments,
  getVerifiedVerificationDocuments,
  getVerificationDocumentUrl,
  rejectVerificationDocument,
  type DocumentStatus,
  type DocumentType,
  type VerificationDocument,
} from "../api/verification";

const DOCUMENT_TYPES: DocumentType[] = [
  "IDENTITY_DOCUMENT",
  "DRIVERS_LICENSE",
  "VEHICLE_REGISTRATION",
  "INSURANCE",
  "BUSINESS_DOCUMENT",
  "OTHER",
];

type ViewFilter = "PENDING" | "VERIFIED";

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function documentTypeLabel(type: DocumentType) {
  return type
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function statusClass(status: DocumentStatus) {
  return `verification-status verification-status-${status.toLowerCase()}`;
}

function documentOwner(document: VerificationDocument) {
  const user = document.user;

  if (!user) return document.userId;

  const name = [user.firstName, user.lastName]
    .filter(Boolean)
    .join(" ");

  return name || user.email || user.phone || document.userId;
}

export default function VerificationCenter() {
  const [pending, setPending] = useState<VerificationDocument[]>([]);
  const [verified, setVerified] = useState<VerificationDocument[]>([]);
  const [view, setView] = useState<ViewFilter>("PENDING");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<DocumentType | "ALL">("ALL");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [actionError, setActionError] = useState("");
  const [documentLoading, setDocumentLoading] = useState(false);

  const loadVerificationData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [pendingDocuments, verifiedDocuments] = await Promise.all([
        getPendingVerificationDocuments(),
        getVerifiedVerificationDocuments(),
      ]);

      setPending(pendingDocuments);
      setVerified(verifiedDocuments);

      setSelectedId((current) => {
        const currentList =
          view === "PENDING" ? pendingDocuments : verifiedDocuments;

        if (current && currentList.some((item) => item.id === current)) {
          return current;
        }

        return currentList[0]?.id ?? null;
      });
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load verification records.",
      );
    } finally {
      setLoading(false);
    }
  }, [view]);

  useEffect(() => {
    void loadVerificationData();
  }, [loadVerificationData]);

  const currentDocuments = view === "PENDING" ? pending : verified;

  const filteredDocuments = useMemo(() => {
    const query = search.trim().toLowerCase();

    return currentDocuments.filter((document) => {
      if (typeFilter !== "ALL" && document.type !== typeFilter) {
        return false;
      }

      if (!query) return true;

      const haystack = [
        documentOwner(document),
        document.user?.email ?? "",
        document.user?.phone ?? "",
        document.user?.role ?? "",
        document.type,
        document.status,
        document.verificationProvider ?? "",
        document.externalVerificationId ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [currentDocuments, search, typeFilter]);

  const selectedDocument = currentDocuments.find(
    (document) => document.id === selectedId,
  );

  const metrics = useMemo(() => {
    const all = [...pending, ...verified];

    const unique = new Map<string, VerificationDocument>();

    for (const document of all) {
      unique.set(document.id, document);
    }

    const records = [...unique.values()];

    return {
      total: records.length,
      pending: pending.length,
      verified: verified.length,
      identity: records.filter(
        (document) => document.type === "IDENTITY_DOCUMENT",
      ).length,
      rejected: records.filter(
        (document) => document.status === "REJECTED",
      ).length,
    };
  }, [pending, verified]);

  async function handleOpenDocument() {
    if (!selectedDocument) return;

    // Open a blank tab synchronously so browser popup blockers do not
    // prevent the document from opening after the async API request.
    const documentWindow = window.open("about:blank", "_blank");

    try {
      setDocumentLoading(true);
      setActionError("");

      const result = await getVerificationDocumentUrl(selectedDocument.id);

      if (!result.url) {
        throw new Error("Document URL was not returned by the server.");
      }

      if (documentWindow) {
        documentWindow.location.href = result.url;
      } else {
        window.location.href = result.url;
      }
    } catch (requestError) {
      if (documentWindow) {
        documentWindow.close();
      }

      setActionError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to open the submitted document.",
      );
    } finally {
      setDocumentLoading(false);
    }
  }

  async function handleApprove() {
    if (!selectedDocument) return;

    try {
      setActionLoading(true);
      setActionError("");

      await approveVerificationDocument(selectedDocument.id);

      await loadVerificationData();

      setView("VERIFIED");
      setShowRejectForm(false);
    } catch (requestError) {
      if (axios.isAxiosError(requestError)) {
        const backendError = requestError.response?.data?.error;

        setActionError(
          typeof backendError === "string"
            ? backendError
            : "Unable to approve this document.",
        );
      } else {
        setActionError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to approve this document.",
        );
      }
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReject() {
    if (!selectedDocument) return;

    const reason = rejectionReason.trim();

    if (!reason) {
      setActionError("A rejection reason is required.");
      return;
    }

    try {
      setActionLoading(true);
      setActionError("");

      await rejectVerificationDocument(selectedDocument.id, reason);

      setRejectionReason("");
      setShowRejectForm(false);

      await loadVerificationData();

      setSelectedId(null);
    } catch (requestError) {
      setActionError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to reject this document.",
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
              TRUST / VERIFICATION CENTER
            </span>
            <h1>Verification Center</h1>
            <p>
              Loading identity and document verification operations…
            </p>
          </div>
        </div>

        <div className="module-loading">
          Loading verification records…
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
              TRUST / VERIFICATION CENTER
            </span>
            <h1>Verification Center</h1>
            <p>
              Verification administration could not be loaded.
            </p>
          </div>
        </div>

        <div className="module-error">
          <strong>Unable to load verification records</strong>
          <span>{error}</span>

          <button
            type="button"
            onClick={() => void loadVerificationData()}
          >
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
            TRUST / VERIFICATION CENTER
          </span>

          <h1>Verification Center</h1>

          <p>
            Review submitted documents, verification status, and
            administrator approval decisions across TransConet.
          </p>
        </div>

        <button
          type="button"
          className="module-refresh"
          onClick={() => void loadVerificationData()}
          disabled={loading || actionLoading}
        >
          Refresh
        </button>
      </div>

      <div className="verification-metrics">
        <button
          type="button"
          className="verification-metric"
          onClick={() => setView("PENDING")}
        >
          <span>Pending review</span>
          <strong>{metrics.pending}</strong>
        </button>

        <button
          type="button"
          className="verification-metric"
          onClick={() => setView("VERIFIED")}
        >
          <span>Approved</span>
          <strong>{metrics.verified}</strong>
        </button>

        <div className="verification-metric">
          <span>Total records</span>
          <strong>{metrics.total}</strong>
        </div>

        <div className="verification-metric">
          <span>Identity documents</span>
          <strong>{metrics.identity}</strong>
        </div>

        <div className="verification-metric">
          <span>Rejected records</span>
          <strong>{metrics.rejected}</strong>
        </div>
      </div>

      <div className="verification-tabs">
        <button
          type="button"
          className={view === "PENDING" ? "active" : ""}
          onClick={() => {
            setView("PENDING");
            setSelectedId(pending[0]?.id ?? null);
            setShowRejectForm(false);
          }}
        >
          Pending review
          <span>{pending.length}</span>
        </button>

        <button
          type="button"
          className={view === "VERIFIED" ? "active" : ""}
          onClick={() => {
            setView("VERIFIED");
            setSelectedId(verified[0]?.id ?? null);
            setShowRejectForm(false);
          }}
        >
          Verified
          <span>{verified.length}</span>
        </button>
      </div>

      <div className="verification-workspace">
        <div className="verification-directory">
          <div className="verification-directory-header">
            <div>
              <h2>
                {view === "PENDING"
                  ? "Documents awaiting review"
                  : "Approved verification records"}
              </h2>

              <span>
                {filteredDocuments.length} records
              </span>
            </div>

            <div className="verification-filters">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search person, email or document"
                aria-label="Search verification records"
              />

              <select
                value={typeFilter}
                onChange={(event) =>
                  setTypeFilter(
                    event.target.value as DocumentType | "ALL",
                  )
                }
                aria-label="Filter verification records by document type"
              >
                <option value="ALL">All document types</option>

                {DOCUMENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {documentTypeLabel(type)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {filteredDocuments.length === 0 ? (
            <div className="verification-empty">
              No verification records match the current view.
            </div>
          ) : (
            <div className="verification-table-wrap">
              <table className="verification-table">
                <thead>
                  <tr>
                    <th>Applicant</th>
                    <th>Document</th>
                    <th>Provider</th>
                    <th>Status</th>
                    <th>Submitted</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredDocuments.map((document) => (
                    <tr
                      key={document.id}
                      className={
                        document.id === selectedId
                          ? "verification-row-selected"
                          : ""
                      }
                      onClick={() => {
                        setSelectedId(document.id);
                        setShowRejectForm(false);
                        setActionError("");
                      }}
                    >
                      <td>
                        <strong>{documentOwner(document)}</strong>
                        <span>
                          {document.user?.email ??
                            document.user?.phone ??
                            document.userId}
                        </span>
                      </td>

                      <td>
                        <strong>
                          {documentTypeLabel(document.type)}
                        </strong>
                        <span>{document.user?.role ?? "—"}</span>
                      </td>

                      <td>
                        <strong>
                          {document.verificationProvider ?? "Not verified"}
                        </strong>

                        <span>
                          {document.externalVerificationId ??
                            "No external reference"}
                        </span>
                      </td>

                      <td>
                        <span className={statusClass(document.status)}>
                          {document.status.replace("_", " ")}
                        </span>
                      </td>

                      <td>
                        <strong>
                          {formatDate(document.createdAt)}
                        </strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <aside className="verification-detail">
          {!selectedDocument ? (
            <div className="verification-empty">
              Select a verification record to inspect it.
            </div>
          ) : (
            <>
              <div className="verification-detail-header">
                <span className="module-eyebrow">
                  VERIFICATION RECORD
                </span>

                <h2>{documentOwner(selectedDocument)}</h2>

                <span
                  className={statusClass(selectedDocument.status)}
                >
                  {selectedDocument.status.replace("_", " ")}
                </span>
              </div>

              <div className="verification-detail-grid">
                <div>
                  <span>Document type</span>
                  <strong>
                    {documentTypeLabel(selectedDocument.type)}
                  </strong>
                </div>

                <div>
                  <span>Applicant role</span>
                  <strong>
                    {selectedDocument.user?.role ?? "—"}
                  </strong>
                </div>

                <div>
                  <span>Email</span>
                  <strong>
                    {selectedDocument.user?.email ?? "—"}
                  </strong>
                </div>

                <div>
                  <span>Phone</span>
                  <strong>
                    {selectedDocument.user?.phone ?? "—"}
                  </strong>
                </div>

                <div>
                  <span>Verification provider</span>
                  <strong>
                    {selectedDocument.verificationProvider ?? "—"}
                  </strong>
                </div>

                <div>
                  <span>External verification ID</span>
                  <strong>
                    {selectedDocument.externalVerificationId ?? "—"}
                  </strong>
                </div>

                <div>
                  <span>Provider verification date</span>
                  <strong>
                    {formatDate(selectedDocument.verifiedAt)}
                  </strong>
                </div>

                <div>
                  <span>Submitted</span>
                  <strong>
                    {formatDate(selectedDocument.createdAt)}
                  </strong>
                </div>

                <div>
                  <span>Admin approval date</span>
                  <strong>
                    {formatDate(selectedDocument.adminApprovedAt)}
                  </strong>
                </div>

                <div>
                  <span>Reviewed by</span>
                  <strong>
                    {selectedDocument.reviewedBy ?? "—"}
                  </strong>
                </div>
              </div>

              <div className="verification-document-panel">
                <div>
                  <span>Submitted document</span>
                  <strong>
                    {documentTypeLabel(selectedDocument.type)}
                  </strong>
                </div>

                <button
                  type="button"
                  onClick={() => void handleOpenDocument()}
                  disabled={documentLoading}
                  className="verification-document-link"
                >
                  {documentLoading ? "Opening document…" : "Open document"}
                </button>
              </div>

              {selectedDocument.rejectionReason && (
                <div className="verification-rejection">
                  <span>Rejection reason</span>
                  <strong>
                    {selectedDocument.rejectionReason}
                  </strong>
                </div>
              )}

              {actionError && (
                <div className="verification-action-error">
                  {actionError}
                </div>
              )}

              {view === "PENDING" &&
                selectedDocument.status === "PENDING" && (
                  <div className="verification-actions">
                    {!showRejectForm ? (
                      <>
                        <button
                          type="button"
                          className="verification-approve"
                          onClick={() => void handleApprove()}
                          disabled={actionLoading}
                        >
                          {actionLoading
                            ? "Processing…"
                            : "Approve document"}
                        </button>

                        <button
                          type="button"
                          className="verification-reject"
                          onClick={() => {
                            setShowRejectForm(true);
                            setActionError("");
                          }}
                          disabled={actionLoading}
                        >
                          Reject document
                        </button>
                      </>
                    ) : (
                      <div className="verification-reject-form">
                        <label htmlFor="verification-rejection">
                          Rejection reason
                        </label>

                        <textarea
                          id="verification-rejection"
                          value={rejectionReason}
                          onChange={(event) =>
                            setRejectionReason(event.target.value)
                          }
                          maxLength={1000}
                          rows={5}
                          placeholder="Explain why this document cannot be approved."
                        />

                        <div>
                          <button
                            type="button"
                            onClick={() => {
                              setShowRejectForm(false);
                              setRejectionReason("");
                              setActionError("");
                            }}
                            disabled={actionLoading}
                          >
                            Cancel
                          </button>

                          <button
                            type="button"
                            className="verification-reject"
                            onClick={() => void handleReject()}
                            disabled={actionLoading}
                          >
                            {actionLoading
                              ? "Rejecting…"
                              : "Confirm rejection"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
            </>
          )}
        </aside>
      </div>
    </section>
  );
}
