import axios from "axios";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  approveTransporterVerification,
  approveVerificationDocument,
  getApprovedCustomerVerifications,
  getFailedCustomerVerifications,
  getApprovedTransporterVerifications,
  getPendingCustomerVerifications,
  getPendingTransporterVerifications,
  getPendingVerificationDocuments,
  getVerifiedVerificationDocuments,
  getVerificationDocumentUrl,
  rejectTransporterVerification,
  rejectVerificationDocument,
  type CustomerVerification,
  type CustomerVerificationType,
  type DocumentType,
  type TransporterVerification,
  type TransporterVerificationType,
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

type ViewFilter = "PENDING" | "VERIFIED" | "FAILED";
type CenterMode = "CUSTOMER" | "DOCUMENTS" | "TRANSPORTER";

const TRANSPORTER_VERIFICATION_TYPES: TransporterVerificationType[] = [
  "NIN",
  "DRIVERS_LICENSE",
  "BUSINESS_REGISTRATION",
];

function transporterVerificationLabel(type: TransporterVerificationType) {
  if (type === "NIN") return "NIN";
  if (type === "DRIVERS_LICENSE") return "Driver's License";
  return "Business Registration";
}

const CUSTOMER_VERIFICATION_TYPES: CustomerVerificationType[] = [
  "NIN",
  "DRIVERS_LICENSE",
];

function customerVerificationLabel(type: CustomerVerificationType) {
  return type === "NIN" ? "NIN" : "Driver's License";
}

function customerOwner(verification: CustomerVerification) {
  const user = verification.user;

  if (!user) return verification.userId;

  const name = [user.firstName, user.lastName]
    .filter(Boolean)
    .join(" ");

  return name || user.email || user.phone || verification.userId;
}

function transporterOwner(verification: TransporterVerification) {
  const user = verification.user;

  if (!user) return verification.userId;

  const name = [user.firstName, user.lastName]
    .filter(Boolean)
    .join(" ");

  return name || user.email || user.phone || verification.userId;
}

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

function statusClass(status: string) {
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
  const [mode, setMode] = useState<CenterMode>("DOCUMENTS");

  const [pending, setPending] = useState<VerificationDocument[]>([]);
  const [verified, setVerified] = useState<VerificationDocument[]>([]);

  const [pendingCustomer, setPendingCustomer] = useState<
    CustomerVerification[]
  >([]);
  const [approvedCustomer, setApprovedCustomer] = useState<
    CustomerVerification[]
  >([]);

  const [failedCustomer, setFailedCustomer] = useState<
    CustomerVerification[]
  >([]);

  const [pendingTransporter, setPendingTransporter] = useState<
    TransporterVerification[]
  >([]);
  const [approvedTransporter, setApprovedTransporter] = useState<
    TransporterVerification[]
  >([]);
  const [view, setView] = useState<ViewFilter>("PENDING");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<
    DocumentType | CustomerVerificationType | TransporterVerificationType | "ALL"
  >("ALL");
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

      const [
        pendingDocuments,
        verifiedDocuments,
        pendingCustomerVerifications,
        approvedCustomerVerifications,
        failedCustomerVerifications,
        pendingTransporterVerifications,
        approvedTransporterVerifications,
      ] = await Promise.all([
        getPendingVerificationDocuments(),
        getVerifiedVerificationDocuments(),
        getPendingCustomerVerifications(),
        getApprovedCustomerVerifications(),
        getFailedCustomerVerifications(),
        getPendingTransporterVerifications(),
        getApprovedTransporterVerifications(),
      ]);

      setPending(pendingDocuments);
      setVerified(verifiedDocuments);
      setPendingCustomer(pendingCustomerVerifications);
      setApprovedCustomer(approvedCustomerVerifications);
      setFailedCustomer(failedCustomerVerifications);
      setPendingTransporter(pendingTransporterVerifications);
      setApprovedTransporter(approvedTransporterVerifications);

      setSelectedId((current) => {
        const currentList =
          mode === "CUSTOMER"
            ? view === "PENDING"
              ? pendingCustomerVerifications
              : view === "VERIFIED"
                ? approvedCustomerVerifications
                : failedCustomerVerifications
            : mode === "TRANSPORTER"
              ? view === "PENDING"
                ? pendingTransporterVerifications
                : approvedTransporterVerifications
              : view === "PENDING"
                ? pendingDocuments
                : verifiedDocuments;

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
  }, [mode, view]);

  useEffect(() => {
    void loadVerificationData();
  }, [loadVerificationData]);

  const currentDocuments = view === "PENDING" ? pending : verified;

  const currentCustomerVerifications =
    view === "PENDING"
      ? pendingCustomer
      : view === "VERIFIED"
        ? approvedCustomer
        : failedCustomer;

  const filteredDocuments = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (mode === "CUSTOMER") return [];

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
  }, [currentDocuments, mode, search, typeFilter]);

  const filteredCustomerVerifications = useMemo(() => {
    const query = search.trim().toLowerCase();

    return currentCustomerVerifications.filter((verification) => {
      if (
        typeFilter !== "ALL" &&
        CUSTOMER_VERIFICATION_TYPES.includes(
          typeFilter as CustomerVerificationType,
        ) &&
        verification.type !== typeFilter
      ) {
        return false;
      }

      if (!query) return true;

      const haystack = [
        customerOwner(verification),
        verification.user?.email ?? "",
        verification.user?.phone ?? "",
        verification.type,
        verification.providerStatus,
        verification.adminStatus,
        verification.verificationProvider,
        verification.verificationNumber,
        verification.externalVerificationId ?? "",
        verification.user?.customerProfile?.customerType ?? "",
        verification.user?.customerProfile?.verificationStatus ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [currentCustomerVerifications, search, typeFilter]);

  const selectedCustomerVerification =
    mode === "CUSTOMER"
      ? currentCustomerVerifications.find(
          (verification) => verification.id === selectedId,
        )
      : undefined;

  const selectedDocument =
    mode === "DOCUMENTS"
      ? currentDocuments.find((document) => document.id === selectedId)
      : undefined;

  const currentTransporterVerifications =
    view === "PENDING" ? pendingTransporter : approvedTransporter;

  const filteredTransporterVerifications = useMemo(() => {
    const query = search.trim().toLowerCase();

    return currentTransporterVerifications.filter((verification) => {
      if (typeFilter !== "ALL" && verification.type !== typeFilter) {
        return false;
      }

      if (!query) return true;

      const haystack = [
        transporterOwner(verification),
        verification.user?.email ?? "",
        verification.user?.phone ?? "",
        verification.type,
        verification.providerStatus,
        verification.adminStatus,
        verification.verificationProvider,
        verification.verificationNumber,
        verification.externalVerificationId ?? "",
        verification.user?.transporterProfile?.transporterType ?? "",
        verification.user?.transporterProfile?.companyName ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [currentTransporterVerifications, search, typeFilter]);

  const selectedTransporterVerification =
    mode === "TRANSPORTER"
      ? currentTransporterVerifications.find(
          (verification) => verification.id === selectedId,
        )
      : undefined;

  const metrics = useMemo(() => {
    const all = [...pending, ...verified];

    const unique = new Map<string, VerificationDocument>();

    for (const document of all) {
      unique.set(document.id, document);
    }

    const records = [...unique.values()];

    const allTransporter = [
      ...pendingTransporter,
      ...approvedTransporter,
    ];

    const uniqueTransporter = new Map<string, TransporterVerification>();

    for (const verification of allTransporter) {
      uniqueTransporter.set(verification.id, verification);
    }

    const transporterRecords = [...uniqueTransporter.values()];

    const allCustomer = [
      ...pendingCustomer,
      ...approvedCustomer,
      ...failedCustomer,
    ];

    const uniqueCustomer = new Map<string, CustomerVerification>();

    for (const verification of allCustomer) {
      uniqueCustomer.set(verification.id, verification);
    }

    const customerRecords = [...uniqueCustomer.values()];

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
    customerTotal: customerRecords.length,
    customerPending: pendingCustomer.length,
    customerApproved: approvedCustomer.length,
      customerFailed: failedCustomer.length,
      transporterTotal: transporterRecords.length,
      transporterPending: pendingTransporter.length,
      transporterApproved: approvedTransporter.length,
      transporterRejected: transporterRecords.filter(
        (verification) => verification.adminStatus === "REJECTED",
      ).length,
    };
  }, [
    pending,
    verified,
      pendingCustomer,
      approvedCustomer,
    failedCustomer,
    pendingTransporter,
    approvedTransporter,
  ]);

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

  async function handleApproveTransporterVerification() {
    if (!selectedTransporterVerification) return;

    try {
      setActionLoading(true);
      setActionError("");

      await approveTransporterVerification(
        selectedTransporterVerification.id,
      );

      await loadVerificationData();

      setView("VERIFIED");
      setShowRejectForm(false);
    } catch (requestError) {
      if (axios.isAxiosError(requestError)) {
        const backendError = requestError.response?.data?.error;

        setActionError(
          typeof backendError === "string"
            ? backendError
            : "Unable to approve this transporter verification.",
        );
      } else {
        setActionError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to approve this transporter verification.",
        );
      }
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRejectTransporterVerification() {
    if (!selectedTransporterVerification) return;

    const reason = rejectionReason.trim();

    if (!reason) {
      setActionError("A rejection reason is required.");
      return;
    }

    try {
      setActionLoading(true);
      setActionError("");

      await rejectTransporterVerification(
        selectedTransporterVerification.id,
        reason,
      );

      setRejectionReason("");
      setShowRejectForm(false);

      await loadVerificationData();

      setSelectedId(null);
    } catch (requestError) {
      setActionError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to reject this transporter verification.",
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
          className={mode === "CUSTOMER" ? "active" : ""}
          onClick={() => {
            setMode("CUSTOMER");
            setTypeFilter("ALL");
            setSelectedId(currentCustomerVerifications[0]?.id ?? null);
            setShowRejectForm(false);
            setActionError("");
          }}
        >
          Customer Verification
          <span>{metrics.customerTotal}</span>
        </button>

        <button
          type="button"
          className={mode === "DOCUMENTS" ? "active" : ""}
          onClick={() => {
            setMode("DOCUMENTS");
            setTypeFilter("ALL");
            setSelectedId(
              view === "PENDING"
                ? pending[0]?.id ?? null
                : verified[0]?.id ?? null,
            );
            setShowRejectForm(false);
            setActionError("");
          }}
        >
          Documents
          <span>{metrics.total}</span>
        </button>

        <button
          type="button"
          className={mode === "TRANSPORTER" ? "active" : ""}
          onClick={() => {
            setMode("TRANSPORTER");
            setTypeFilter("ALL");
            setSelectedId(
              view === "PENDING"
                ? pendingTransporter[0]?.id ?? null
                : approvedTransporter[0]?.id ?? null,
            );
            setShowRejectForm(false);
            setActionError("");
          }}
        >
          Transporter verifications
          <span>{metrics.transporterTotal}</span>
        </button>
      </div>

      {mode === "CUSTOMER" && (
        <div className="verification-tabs">
          <button
            type="button"
            className={view === "PENDING" ? "active" : ""}
            onClick={() => {
              setView("PENDING");
              setSelectedId(pendingCustomer[0]?.id ?? null);
              setShowRejectForm(false);
              setActionError("");
            }}
          >
            Pending
            <span>{metrics.customerPending}</span>
          </button>

          <button
            type="button"
            className={view === "VERIFIED" ? "active" : ""}
            onClick={() => {
              setView("VERIFIED");
              setSelectedId(approvedCustomer[0]?.id ?? null);
              setShowRejectForm(false);
              setActionError("");
            }}
          >
            Verified
            <span>{metrics.customerApproved}</span>
          </button>

          <button
            type="button"
            className={view === "FAILED" ? "active" : ""}
            onClick={() => {
              setView("FAILED");
              setSelectedId(failedCustomer[0]?.id ?? null);
              setShowRejectForm(false);
              setActionError("");
            }}
          >
            Failed
            <span>{metrics.customerFailed}</span>
          </button>
        </div>
      )}

      {mode === "DOCUMENTS" && (
        <div className="verification-tabs">
          <button
            type="button"
            className={view === "PENDING" ? "active" : ""}
            onClick={() => {
              setView("PENDING");
              setSelectedId(pending[0]?.id ?? null);
              setShowRejectForm(false);
              setActionError("");
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
              setActionError("");
            }}
          >
            Verified
            <span>{verified.length}</span>
          </button>
        </div>
      )}

      {mode === "TRANSPORTER" && (
        <div className="verification-tabs">
          <button
            type="button"
            className={view === "PENDING" ? "active" : ""}
            onClick={() => {
              setView("PENDING");
              setSelectedId(pendingTransporter[0]?.id ?? null);
              setShowRejectForm(false);
              setActionError("");
            }}
          >
            Pending review
            <span>{pendingTransporter.length}</span>
          </button>

          <button
            type="button"
            className={view === "VERIFIED" ? "active" : ""}
            onClick={() => {
              setView("VERIFIED");
              setSelectedId(approvedTransporter[0]?.id ?? null);
              setShowRejectForm(false);
              setActionError("");
            }}
          >
            Approved
            <span>{approvedTransporter.length}</span>
          </button>
        </div>
      )}

      <div className="verification-workspace">
        <div className="verification-directory">
          {mode === "CUSTOMER" ? (
            <>
              <div className="verification-directory-header">
                <div>
                  <h2>
                    {view === "PENDING"
                      ? "Customer verifications awaiting provider result"
                      : view === "VERIFIED"
                        ? "Verified customer verifications"
                        : "Failed customer verifications"}
                  </h2>
                  <span>{filteredCustomerVerifications.length} records</span>
                </div>

                <div className="verification-filters">
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search customer, email or identification"
                    aria-label="Search customer verification records"
                  />

                  <select
                    value={typeFilter}
                    onChange={(event) =>
                      setTypeFilter(
                        event.target.value as CustomerVerificationType | "ALL",
                      )
                    }
                    aria-label="Filter customer verifications by identification type"
                  >
                    <option value="ALL">All identification types</option>
                    {CUSTOMER_VERIFICATION_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {customerVerificationLabel(type)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {filteredCustomerVerifications.length === 0 ? (
                <div className="verification-empty">
                  No customer verification records match the current view.
                </div>
              ) : (
                <div className="verification-table-wrap">
                  <table className="verification-table">
                    <thead>
                      <tr>
                        <th>Customer</th>
                        <th>Identification</th>
                        <th>Provider</th>
                        <th>Status</th>
                        <th>Submitted</th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredCustomerVerifications.map((verification) => (
                        <tr
                          key={verification.id}
                          className={
                            verification.id === selectedId
                              ? "verification-row-selected"
                              : ""
                          }
                          onClick={() => {
                            setSelectedId(verification.id);
                            setShowRejectForm(false);
                            setActionError("");
                          }}
                        >
                          <td>
                            <strong>{customerOwner(verification)}</strong>
                            <span>
                              {verification.user?.email ??
                                verification.user?.phone ??
                                verification.userId}
                            </span>
                          </td>

                          <td>
                            <strong>
                              {customerVerificationLabel(verification.type)}
                            </strong>
                            <span>
                              {verification.verificationNumber}
                            </span>
                          </td>

                          <td>
                            <strong>
                              {verification.verificationProvider}
                            </strong>
                            <span>
                              {verification.externalVerificationId ??
                                "No external reference"}
                            </span>
                          </td>

                          <td>
                            <span
                              className={statusClass(
                                verification.providerStatus,
                              )}
                            >
                              {verification.providerStatus}
                            </span>
                          </td>

                          <td>
                            <strong>
                              {formatDate(verification.createdAt)}
                            </strong>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : mode === "DOCUMENTS" ? (
          <>
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
          </>
          ) : (
            <>
              <div className="verification-directory-header">
                <div>
                  <h2>
                    {view === "PENDING"
                      ? "Transporter verifications awaiting review"
                      : "Approved transporter verifications"}
                  </h2>

                  <span>
                    {filteredTransporterVerifications.length} records
                  </span>
                </div>

                <div className="verification-filters">
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search transporter, number or reference"
                    aria-label="Search transporter verification records"
                  />

                  <select
                    value={typeFilter}
                    onChange={(event) =>
                      setTypeFilter(
                        event.target.value as
                          | TransporterVerificationType
                          | "ALL",
                      )
                    }
                    aria-label="Filter transporter verifications by type"
                  >
                    <option value="ALL">
                      All transporter verification types
                    </option>

                    {TRANSPORTER_VERIFICATION_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {transporterVerificationLabel(type)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {filteredTransporterVerifications.length === 0 ? (
                <div className="verification-empty">
                  No transporter verification records match the current view.
                </div>
              ) : (
                <div className="verification-table-wrap">
                  <table className="verification-table">
                    <thead>
                      <tr>
                        <th>Transporter</th>
                        <th>Verification</th>
                        <th>Provider</th>
                        <th>Status</th>
                        <th>Submitted</th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredTransporterVerifications.map((verification) => (
                        <tr
                          key={verification.id}
                          className={
                            verification.id === selectedId
                              ? "verification-row-selected"
                              : ""
                          }
                          onClick={() => {
                            setSelectedId(verification.id);
                            setShowRejectForm(false);
                            setActionError("");
                          }}
                        >
                          <td>
                            <strong>
                              {transporterOwner(verification)}
                            </strong>
                            <span>
                              {verification.user?.email ??
                                verification.user?.phone ??
                                verification.userId}
                            </span>
                          </td>

                          <td>
                            <strong>
                              {transporterVerificationLabel(
                                verification.type,
                              )}
                            </strong>
                            <span>
                              {verification.verificationNumber}
                            </span>
                          </td>

                          <td>
                            <strong>
                              {verification.verificationProvider}
                            </strong>
                            <span>
                              {verification.externalVerificationId ??
                                "No external reference"}
                            </span>
                          </td>

                          <td>
                            <span
                              className={statusClass(
                                verification.adminStatus,
                              )}
                            >
                              {verification.adminStatus.replace("_", " ")}
                            </span>
                          </td>

                          <td>
                            <strong>
                              {formatDate(verification.createdAt)}
                            </strong>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>

        <aside className="verification-detail">
          {mode === "CUSTOMER" ? (
            !selectedCustomerVerification ? (
              <div className="verification-empty">
                Select a customer verification record to inspect it.
              </div>
            ) : (
              <>
                <div className="verification-detail-header">
                  <span className="module-eyebrow">
                    CUSTOMER VERIFICATION
                  </span>

                  <h2>{customerOwner(selectedCustomerVerification)}</h2>

                  <span
                    className={statusClass(
                      selectedCustomerVerification.providerStatus,
                    )}
                  >
                    {selectedCustomerVerification.providerStatus}
                  </span>
                </div>

                <div className="verification-detail-grid">
                  <div>
                    <span>Identification</span>
                    <strong>
                      {customerVerificationLabel(
                        selectedCustomerVerification.type,
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Identification number</span>
                    <strong>
                      {selectedCustomerVerification.verificationNumber}
                    </strong>
                  </div>

                  <div>
                    <span>Customer</span>
                    <strong>{customerOwner(selectedCustomerVerification)}</strong>
                  </div>

                  <div>
                    <span>Email</span>
                    <strong>
                      {selectedCustomerVerification.user?.email ?? "—"}
                    </strong>
                  </div>

                  <div>
                    <span>Phone</span>
                    <strong>
                      {selectedCustomerVerification.user?.phone ?? "—"}
                    </strong>
                  </div>

                  <div>
                    <span>Verification provider</span>
                    <strong>
                      {selectedCustomerVerification.verificationProvider}
                    </strong>
                  </div>

                  <div>
                    <span>Provider status</span>
                    <strong>
                      {selectedCustomerVerification.providerStatus}
                    </strong>
                  </div>

                  <div>
                    <span>External verification ID</span>
                    <strong>
                      {selectedCustomerVerification.externalVerificationId ??
                        "—"}
                    </strong>
                  </div>

                  <div>
                    <span>Provider verification date</span>
                    <strong>
                      {formatDate(selectedCustomerVerification.verifiedAt)}
                    </strong>
                  </div>

                  <div>
                    <span>Submitted</span>
                    <strong>
                      {formatDate(selectedCustomerVerification.createdAt)}
                    </strong>
                  </div>

                  <div>
                    <span>Customer profile status</span>
                    <strong>
                      {selectedCustomerVerification.user?.customerProfile
                        ?.verificationStatus ?? "—"}
                    </strong>
                  </div>
                </div>

                <div className="verification-document-panel">
                  <div>
                    <span>Verification source</span>
                    <strong>
                      Youverify
                    </strong>
                  </div>

                  <div>
                    <span>Administrative action</span>
                    <strong>
                      Provider result is authoritative
                    </strong>
                  </div>
                </div>

                {selectedCustomerVerification.providerResponse && (
                  <div className="verification-rejection">
                    <span>Provider response</span>
                    <strong>
                      Provider response available for audit
                    </strong>
                  </div>
                )}
              </>
            )
          ) : mode === "DOCUMENTS" ? (
          !selectedDocument ? (
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
          )
          ) : !selectedTransporterVerification ? (
            <div className="verification-empty">
              Select a transporter verification record to inspect it.
            </div>
          ) : (
            <>
              <div className="verification-detail-header">
                <span className="module-eyebrow">
                  TRANSPORTER VERIFICATION
                </span>

                <h2>{transporterOwner(selectedTransporterVerification)}</h2>

                <span
                  className={statusClass(
                    selectedTransporterVerification.adminStatus,
                  )}
                >
                  {selectedTransporterVerification.adminStatus.replace(
                    "_",
                    " ",
                  )}
                </span>
              </div>

              <div className="verification-detail-grid">
                <div>
                  <span>Verification type</span>
                  <strong>
                    {transporterVerificationLabel(
                      selectedTransporterVerification.type,
                    )}
                  </strong>
                </div>

                <div>
                  <span>Transporter type</span>
                  <strong>
                    {selectedTransporterVerification.user?.transporterProfile
                      ?.transporterType ?? "—"}
                  </strong>
                </div>

                <div>
                  <span>Email</span>
                  <strong>
                    {selectedTransporterVerification.user?.email ?? "—"}
                  </strong>
                </div>

                <div>
                  <span>Phone</span>
                  <strong>
                    {selectedTransporterVerification.user?.phone ?? "—"}
                  </strong>
                </div>

                <div>
                  <span>Verification number</span>
                  <strong>
                    {selectedTransporterVerification.verificationNumber}
                  </strong>
                </div>

                <div>
                  <span>Verification provider</span>
                  <strong>
                    {selectedTransporterVerification.verificationProvider}
                  </strong>
                </div>

                <div>
                  <span>Provider status</span>
                  <strong>
                    {selectedTransporterVerification.providerStatus}
                  </strong>
                </div>

                <div>
                  <span>External verification ID</span>
                  <strong>
                    {selectedTransporterVerification.externalVerificationId ??
                      "—"}
                  </strong>
                </div>

                <div>
                  <span>Provider verification date</span>
                  <strong>
                    {formatDate(selectedTransporterVerification.verifiedAt)}
                  </strong>
                </div>

                <div>
                  <span>Submitted</span>
                  <strong>
                    {formatDate(selectedTransporterVerification.createdAt)}
                  </strong>
                </div>

                <div>
                  <span>Admin decision date</span>
                  <strong>
                    {formatDate(
                      selectedTransporterVerification.adminApprovedAt,
                    )}
                  </strong>
                </div>

                <div>
                  <span>Reviewed by</span>
                  <strong>
                    {selectedTransporterVerification.reviewedBy ?? "—"}
                  </strong>
                </div>
              </div>

              {selectedTransporterVerification.user?.transporterProfile
                ?.companyName && (
                <div className="verification-document-panel">
                  <div>
                    <span>Business name</span>
                    <strong>
                      {
                        selectedTransporterVerification.user
                          .transporterProfile.companyName
                      }
                    </strong>
                  </div>
                </div>
              )}

              {selectedTransporterVerification.rejectionReason && (
                <div className="verification-rejection">
                  <span>Rejection reason</span>
                  <strong>
                    {selectedTransporterVerification.rejectionReason}
                  </strong>
                </div>
              )}

              {actionError && (
                <div className="verification-action-error">
                  {actionError}
                </div>
              )}

              {view === "PENDING" &&
                selectedTransporterVerification.adminStatus === "PENDING" && (
                  <div className="verification-actions">
                    {!showRejectForm ? (
                      <>
                        <button
                          type="button"
                          className="verification-approve"
                          onClick={() =>
                            void handleApproveTransporterVerification()
                          }
                          disabled={
                            actionLoading ||
                            selectedTransporterVerification.providerStatus !==
                              "SUCCESS"
                          }
                        >
                          {actionLoading
                            ? "Processing…"
                            : "Approve verification"}
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
                          Reject verification
                        </button>
                      </>
                    ) : (
                      <div className="verification-reject-form">
                        <label htmlFor="transporter-verification-rejection">
                          Rejection reason
                        </label>

                        <textarea
                          id="transporter-verification-rejection"
                          value={rejectionReason}
                          onChange={(event) =>
                            setRejectionReason(event.target.value)
                          }
                          maxLength={1000}
                          rows={5}
                          placeholder="Explain why this transporter verification cannot be approved."
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
                            onClick={() =>
                              void handleRejectTransporterVerification()
                            }
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
