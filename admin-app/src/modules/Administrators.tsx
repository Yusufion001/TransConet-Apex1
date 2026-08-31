import { useCallback, useEffect, useMemo, useState } from "react";
import {
  activateAdministrator,
  createAdministrator,
  disableAdministrator,
  getAdministrator,
  getAdministrators,
  suspendAdministrator,
  updateAdministrator,
  type AdminModule,
  type AdminStatus,
  type AdminType,
  type Administrator,
} from "../api/administrators";

const ADMIN_TYPES: AdminType[] = [
  "SUPER_ADMIN",
  "VERIFICATION_ADMIN",
  "SUPPORT_ADMIN",
  "NOTIFICATION_ADMIN",
  "FINANCIAL_ADMIN",
  "FLEET_ADMIN",
  "PARTNER_ADMIN",
  "MARKETING_ADMIN",
  "RISK_ADMIN",
  "REPORTING_ADMIN",
  "AI_ADMIN",
  "FEATURE_ADMIN",
  "DEVELOPER_ADMIN",
  "BACKUP_ADMIN",
  "API_ADMIN",
  "SECURITY_ADMIN",
];

const ADMIN_MODULES: AdminModule[] = [
  "PLATFORM_OVERVIEW",
  "VERIFICATION_CENTER",
  "CONTENT_MANAGEMENT",
  "SUPPORT_CARE",
  "NOTIFICATION_CENTER",
  "SUBSCRIPTION_BILLING",
  "FLEET_MARKETPLACE",
  "PARTNER_MANAGEMENT",
  "MARKETING_CENTER",
  "FINANCIAL_OPERATIONS",
  "RISK_FRAUD",
  "REPORTS_CENTER",
  "AI_AUTOMATION",
  "FEATURE_MANAGEMENT",
  "DEVELOPER_CONSOLE",
  "BACKUP_RECOVERY",
  "ACTIVITY_TIMELINE",
  "ROLE_PERMISSION",
  "PLATFORM_CONFIG",
  "LIVE_TRIPS",
  "ERROR_CENTER",
  "API_MANAGEMENT",
  "SECURITY_CENTER",
  "DATABASE_HEALTH",
];

function labelize(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function statusClass(status: AdminStatus) {
  return `administrator-status administrator-status-${status.toLowerCase()}`;
}

export default function Administrators() {
  const [administrators, setAdministrators] = useState<Administrator[]>([]);
  const [selected, setSelected] = useState<Administrator | null>(null);
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [detailError, setDetailError] = useState("");
  const [notice, setNotice] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createFirstName, setCreateFirstName] = useState("");
  const [createLastName, setCreateLastName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createPhone, setCreatePhone] = useState("");
  const [createType, setCreateType] =
    useState<AdminType>("SUPPORT_ADMIN");
  const [createModules, setCreateModules] = useState<AdminModule[]>([]);
  const [editType, setEditType] = useState<AdminType>("SUPPORT_ADMIN");
  const [editModules, setEditModules] = useState<AdminModule[]>([]);

  const loadAdministrators = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await getAdministrators();
      setAdministrators(data);

      if (selected) {
        const refreshed = data.find((item) => item.userId === selected.userId);
        if (refreshed) {
          setSelected(refreshed);
          setEditType(refreshed.administratorType);
          setEditModules(refreshed.assignedModules);
        }
      }
    } catch {
      setError("Unable to load administrators from the Administration API.");
    } finally {
      setLoading(false);
    }
  }, [selected]);

  async function selectAdministrator(administrator: Administrator) {
    try {
      setDetailLoading(true);
      setDetailError("");
      setNotice("");

      const detail = await getAdministrator(administrator.userId);

      setSelected(detail);
      setEditType(detail.administratorType);
      setEditModules(detail.assignedModules);
    } catch {
      setDetailError("Unable to load administrator details.");
    } finally {
      setDetailLoading(false);
    }
  }

  async function saveAdministrator() {
    if (!selected || selected.isSuperAdministrator) return;

    try {
      setSaving(true);
      setDetailError("");
      setNotice("");

      const updated = await updateAdministrator(selected.userId, {
        administratorType: editType,
        assignedModules: editModules,
      });

      setSelected(updated);
      setAdministrators((current) =>
        current.map((item) =>
          item.userId === updated.userId ? updated : item,
        ),
      );
      setNotice("Administrator permissions updated.");
    } catch {
      setDetailError("Unable to update administrator permissions.");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(
    action: "activate" | "suspend" | "disable",
  ) {
    if (!selected || selected.isSuperAdministrator) return;

    try {
      setSaving(true);
      setDetailError("");
      setNotice("");

      const actions = {
        activate: activateAdministrator,
        suspend: suspendAdministrator,
        disable: disableAdministrator,
      };

      const updated = await actions[action](selected.userId);

      setSelected(updated);
      setAdministrators((current) =>
        current.map((item) =>
          item.userId === updated.userId ? updated : item,
        ),
      );
      setNotice(`Administrator ${action}d successfully.`);
    } catch {
      setDetailError(`Unable to ${action} this administrator.`);
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    void loadAdministrators();
  }, [loadAdministrators]);

  const filteredAdministrators = useMemo(() => {
    const query = search.trim().toLowerCase();

    return administrators.filter((administrator) => {
      const matchesSearch =
        !query ||
        `${administrator.user.firstName} ${administrator.user.lastName}`
          .toLowerCase()
          .includes(query) ||
        (administrator.user.email ?? "").toLowerCase().includes(query) ||
        administrator.administratorType.toLowerCase().includes(query);

      const matchesType =
        !typeFilter || administrator.administratorType === typeFilter;

      const matchesStatus =
        !statusFilter || administrator.status === statusFilter;

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [administrators, search, typeFilter, statusFilter]);

  const activeCount = administrators.filter(
    (administrator) => administrator.status === "ACTIVE",
  ).length;

  const suspendedCount = administrators.filter(
    (administrator) => administrator.status === "SUSPENDED",
  ).length;

  const superAdminCount = administrators.filter(
    (administrator) => administrator.isSuperAdministrator,
  ).length;

  function toggleCreateModule(module: AdminModule) {
    setCreateModules((current) =>
      current.includes(module)
        ? current.filter((item) => item !== module)
        : [...current, module],
    );
  }

  function resetCreateForm() {
    setCreateFirstName("");
    setCreateLastName("");
    setCreateEmail("");
    setCreatePhone("");
    setCreateType("SUPPORT_ADMIN");
    setCreateModules([]);
    setCreateError("");
  }

  async function submitCreateAdministrator() {
    if (
      !createFirstName.trim() ||
      !createLastName.trim() ||
      !createEmail.trim() ||
      createModules.length === 0
    ) {
      setCreateError(
        "First name, last name, email and at least one module are required.",
      );
      return;
    }

    try {
      setCreating(true);
      setCreateError("");
      setNotice("");

      await createAdministrator({
        firstName: createFirstName.trim(),
        lastName: createLastName.trim(),
        email: createEmail.trim().toLowerCase(),
        phone: createPhone.trim() || undefined,
        administratorType: createType,
        assignedModules: createModules,
      });

      setShowCreate(false);
      resetCreateForm();
      setNotice(
        "Administrator created successfully. An invitation email has been sent.",
      );
      await loadAdministrators();
    } catch (error) {
      setCreateError(
        error instanceof Error
          ? error.message
          : "Unable to create administrator.",
      );
    } finally {
      setCreating(false);
    }
  }

  function toggleModule(module: AdminModule) {
    setEditModules((current) =>
      current.includes(module)
        ? current.filter((item) => item !== module)
        : [...current, module],
    );
  }

  return (
    <section className="module-workspace administrators-workspace">
      <div className="module-header">
        <span className="module-kicker">
          TRANSCONET-APEX1 ADMINISTRATION
        </span>
        <h2>Administrator Management</h2>
        <p>
          Govern the administrators who operate the TransConet-Apex1
          Administration Management Platform.
        </p>
      </div>

      {error && (
        <div className="module-card module-error">
          <strong>Administrator directory unavailable</strong>
          <p>{error}</p>
        </div>
      )}

      {notice && (
        <div className="admin-notice">
          <strong>{notice}</strong>
        </div>
      )}

      <div className="stats-grid administrator-stats">
        <Stat label="Administrators" value={administrators.length} />
        <Stat label="Active" value={activeCount} />
        <Stat label="Suspended" value={suspendedCount} />
        <Stat label="Super Administrator" value={superAdminCount} />
      </div>

      <div className="administrator-toolbar">
        <div className="administrator-search">
          <span>Search</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name, email or administrator type"
          />
        </div>

        <label>
          <span>Type</span>
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
          >
            <option value="">All types</option>
            {ADMIN_TYPES.map((type) => (
              <option key={type} value={type}>
                {labelize(type)}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Status</span>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="DISABLED">Disabled</option>
          </select>
        </label>

        <button
          type="button"
          className="primary-action administrator-add-button"
          onClick={() => {
            resetCreateForm();
            setShowCreate(true);
          }}
          disabled={creating}
        >
          + Add Administrator
        </button>

        <button
          type="button"
          className="refresh-button"
          onClick={() => void loadAdministrators()}
          disabled={loading}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>

        <button
          type="button"
          className="primary-action administrator-add-button"
          onClick={() => {
            resetCreateForm();
            setShowCreate(true);
          }}
          disabled={creating}
        >
          + Add Administrator
        </button>
      </div>

      {showCreate && (
        <div className="administrator-modal-backdrop">
          <div
            className="administrator-create-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-administrator-title"
          >
            <div className="administrator-create-header">
              <div>
                <span className="module-kicker">
                  TRANSCONET-APEX1 ADMINISTRATION
                </span>
                <h2 id="create-administrator-title">
                  Add Administrator
                </h2>
                <p>
                  Create an administrator account and send a secure
                  invitation email.
                </p>
              </div>

              <button
                type="button"
                className="modal-close-button"
                onClick={() => {
                  if (!creating) {
                    setShowCreate(false);
                    resetCreateForm();
                  }
                }}
                disabled={creating}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {createError && (
              <div className="module-error administrator-create-error">
                <strong>Unable to create administrator</strong>
                <p>{createError}</p>
              </div>
            )}

            <div className="administrator-form-grid">
              <label>
                <span>First Name</span>
                <input
                  value={createFirstName}
                  onChange={(event) =>
                    setCreateFirstName(event.target.value)
                  }
                  placeholder="First name"
                  disabled={creating}
                />
              </label>

              <label>
                <span>Last Name</span>
                <input
                  value={createLastName}
                  onChange={(event) =>
                    setCreateLastName(event.target.value)
                  }
                  placeholder="Last name"
                  disabled={creating}
                />
              </label>

              <label>
                <span>Email Address</span>
                <input
                  type="email"
                  value={createEmail}
                  onChange={(event) =>
                    setCreateEmail(event.target.value)
                  }
                  placeholder="administrator@example.com"
                  disabled={creating}
                />
              </label>

              <label>
                <span>Phone Number</span>
                <input
                  value={createPhone}
                  onChange={(event) =>
                    setCreatePhone(event.target.value)
                  }
                  placeholder="Optional"
                  disabled={creating}
                />
              </label>

              <label className="administrator-form-full">
                <span>Administrator Type</span>
                <select
                  value={createType}
                  onChange={(event) =>
                    setCreateType(event.target.value as AdminType)
                  }
                  disabled={creating}
                >
                  {ADMIN_TYPES.filter(
                    (type) => type !== "SUPER_ADMIN",
                  ).map((type) => (
                    <option key={type} value={type}>
                      {labelize(type)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="administrator-create-modules">
              <div className="administrator-section-heading">
                <div>
                  <strong>Assigned Modules</strong>
                  <span>
                    Select the administration areas this administrator
                    will be authorized to access.
                  </span>
                </div>
              </div>

              <div className="admin-module-grid">
                {ADMIN_MODULES.map((module) => (
                  <label
                    key={module}
                    className="admin-module-option"
                  >
                    <input
                      type="checkbox"
                      checked={createModules.includes(module)}
                      onChange={() => toggleCreateModule(module)}
                      disabled={creating}
                    />
                    <span>{labelize(module)}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="administrator-create-footer">
              <button
                type="button"
                className="secondary-action"
                onClick={() => {
                  setShowCreate(false);
                  resetCreateForm();
                }}
                disabled={creating}
              >
                Cancel
              </button>

              <button
                type="button"
                className="primary-action"
                onClick={() => void submitCreateAdministrator()}
                disabled={
                  creating ||
                  !createFirstName.trim() ||
                  !createLastName.trim() ||
                  !createEmail.trim() ||
                  createModules.length === 0
                }
              >
                {creating
                  ? "Creating & Sending Invitation…"
                  : "Create & Send Invitation"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="administrator-layout">
        <div className="administrator-directory panel">
          <div className="panel-header">
            <div>
              <h2>Administrator Directory</h2>
              <p>
                {filteredAdministrators.length} administrator
                {filteredAdministrators.length === 1 ? "" : "s"} shown
              </p>
            </div>
          </div>

          {loading ? (
            <div className="administrator-empty">
              <strong>Loading administrators…</strong>
            </div>
          ) : filteredAdministrators.length === 0 ? (
            <div className="administrator-empty">
              <strong>No administrators found</strong>
              <span>
                Adjust the search or filters, or verify that administrator
                records exist.
              </span>
            </div>
          ) : (
            <div className="administrator-list">
              {filteredAdministrators.map((administrator) => {
                const name =
                  `${administrator.user.firstName} ${administrator.user.lastName}`.trim();

                return (
                  <button
                    type="button"
                    key={administrator.userId}
                    className={`administrator-row ${
                      selected?.userId === administrator.userId
                        ? "administrator-row-selected"
                        : ""
                    }`}
                    onClick={() => void selectAdministrator(administrator)}
                  >
                    <div className="administrator-avatar">
                      {name
                        .split(" ")
                        .map((part) => part[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>

                    <div className="administrator-row-main">
                      <strong>{name || "Unnamed Administrator"}</strong>
                      <span>{administrator.user.email ?? "No email"}</span>
                      <small>
                        {labelize(administrator.administratorType)}
                      </small>
                    </div>

                    <span className={statusClass(administrator.status)}>
                      {administrator.status}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <aside className="administrator-detail panel">
          <div className="panel-header">
            <div>
              <h2>Administrator Profile</h2>
              <p>
                {selected
                  ? "Authorized administrator record"
                  : "Select an administrator"}
              </p>
            </div>
          </div>

          {!selected ? (
            <div className="administrator-empty detail-empty">
              <div className="placeholder-icon">A</div>
              <strong>Select an administrator</strong>
              <span>
                Choose a record to inspect its status, role and assigned
                administration modules.
              </span>
            </div>
          ) : detailLoading ? (
            <div className="administrator-empty">
              <strong>Loading administrator…</strong>
            </div>
          ) : (
            <div className="administrator-detail-content">
              <div className="administrator-profile-heading">
                <div className="administrator-avatar administrator-avatar-large">
                  {`${selected.user.firstName}${selected.user.lastName}`
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
                <div>
                  <h3>
                    {selected.user.firstName} {selected.user.lastName}
                  </h3>
                  <span>{selected.user.email ?? "No email address"}</span>
                </div>
              </div>

              <div className="administrator-meta-grid">
                <div>
                  <span>Status</span>
                  <strong className={statusClass(selected.status)}>
                    {selected.status}
                  </strong>
                </div>
                <div>
                  <span>Administrator Type</span>
                  <strong>{labelize(selected.administratorType)}</strong>
                </div>
                <div>
                  <span>Two-Factor Authentication</span>
                  <strong>
                    {selected.twoFactorEnabled ? "Enabled" : "Not enabled"}
                  </strong>
                </div>
                <div>
                  <span>Failed Login Attempts</span>
                  <strong>{selected.failedLoginAttempts}</strong>
                </div>
              </div>

              {selected.isSuperAdministrator ? (
                <div className="super-admin-banner">
                  <strong>Super Administrator</strong>
                  <span>
                    This account is protected by the platform's Super
                    Administrator authorization boundary.
                  </span>
                </div>
              ) : (
                <>
                  <div className="administrator-edit-section">
                    <div className="administrator-section-heading">
                      <div>
                        <strong>Administrator Type</strong>
                        <span>Controls the administrative responsibility.</span>
                      </div>
                    </div>

                    <select
                      value={editType}
                      onChange={(event) =>
                        setEditType(event.target.value as AdminType)
                      }
                    >
                      {ADMIN_TYPES.filter(
                        (type) => type !== "SUPER_ADMIN",
                      ).map((type) => (
                        <option key={type} value={type}>
                          {labelize(type)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="administrator-edit-section">
                    <div className="administrator-section-heading">
                      <div>
                        <strong>Assigned Modules</strong>
                        <span>
                          Administration areas this administrator can access.
                        </span>
                      </div>
                    </div>

                    <div className="admin-module-grid">
                      {ADMIN_MODULES.map((module) => (
                        <label key={module} className="admin-module-option">
                          <input
                            type="checkbox"
                            checked={editModules.includes(module)}
                            onChange={() => toggleModule(module)}
                          />
                          <span>{labelize(module)}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="administrator-actions">
                    <button
                      type="button"
                      className="primary-action"
                      disabled={saving || editModules.length === 0}
                      onClick={() => void saveAdministrator()}
                    >
                      {saving ? "Saving…" : "Save Changes"}
                    </button>

                    {selected.status === "ACTIVE" && (
                      <button
                        type="button"
                        className="secondary-action warning-action"
                        disabled={saving}
                        onClick={() => void changeStatus("suspend")}
                      >
                        Suspend
                      </button>
                    )}

                    {selected.status === "SUSPENDED" && (
                      <button
                        type="button"
                        className="secondary-action"
                        disabled={saving}
                        onClick={() => void changeStatus("activate")}
                      >
                        Activate
                      </button>
                    )}

                    {selected.status !== "DISABLED" && (
                      <button
                        type="button"
                        className="secondary-action danger-action"
                        disabled={saving}
                        onClick={() => void changeStatus("disable")}
                      >
                        Disable
                      </button>
                    )}
                  </div>
                </>
              )}

              {detailError && (
                <div className="module-error administrator-detail-error">
                  <p>{detailError}</p>
                </div>
              )}
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>Administration records</small>
    </div>
  );
}
