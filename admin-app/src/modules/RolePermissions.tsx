import { useEffect, useMemo, useState } from "react";
import {
  getAdminRole,
  getAdminRoles,
  updateAdminPermissions,
  type AdminRole,
} from "../api/role-permissions";
import type { AdminModule } from "../api/administrators";

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

export default function RolePermissions() {
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [selected, setSelected] = useState<AdminRole | null>(null);
  const [search, setSearch] = useState("");
  const [selectedModules, setSelectedModules] = useState<AdminModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [detailError, setDetailError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadRoles() {
    try {
      setLoading(true);
      setError("");

      const data = await getAdminRoles();
      setRoles(data);

      if (selected) {
        const refreshed = data.find(
          (role) => role.userId === selected.userId,
        );

        if (refreshed) {
          setSelected(refreshed);
          setSelectedModules(refreshed.assignedModules);
        }
      }
    } catch {
      setError(
        "Unable to load roles and permissions from the Administration API.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function selectRole(role: AdminRole) {
    try {
      setDetailLoading(true);
      setDetailError("");
      setNotice("");

      const detail = await getAdminRole(role.userId);

      setSelected(detail);
      setSelectedModules(detail.assignedModules);
    } catch {
      setDetailError("Unable to load the selected administrator permissions.");
    } finally {
      setDetailLoading(false);
    }
  }

  function toggleModule(module: AdminModule) {
    if (selected?.isSuperAdministrator) {
      return;
    }

    setSelectedModules((current) =>
      current.includes(module)
        ? current.filter((item) => item !== module)
        : [...current, module],
    );
  }

  async function savePermissions() {
    if (!selected || selected.isSuperAdministrator) {
      return;
    }

    try {
      setSaving(true);
      setDetailError("");
      setNotice("");

      const updated = await updateAdminPermissions(
        selected.userId,
        selectedModules,
      );

      setSelected(updated);
      setSelectedModules(updated.assignedModules);

      setRoles((current) =>
        current.map((role) =>
          role.userId === updated.userId ? updated : role,
        ),
      );

      setNotice("Administrative permissions updated successfully.");
    } catch {
      setDetailError(
        "Unable to update administrative permissions. Verify that your administrator account has ROLE_PERMISSION access.",
      );
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    void loadRoles();
  }, []);

  const filteredRoles = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return roles;
    }

    return roles.filter((role) => {
      const name =
        `${role.user.firstName} ${role.user.lastName}`.toLowerCase();

      return (
        name.includes(query) ||
        (role.user.email ?? "").toLowerCase().includes(query) ||
        role.administratorType.toLowerCase().includes(query)
      );
    });
  }, [roles, search]);

  const assignedCount = selectedModules.length;

  return (
    <section className="module-workspace administrators-workspace">
      <div className="module-header">
        <span className="module-kicker">
          TRANSCONET-APEX1 ADMINISTRATION
        </span>

        <h2>Roles & Permissions</h2>

        <p>
          Control administrative access to the TransConet-Apex1
          Administration Management Platform.
        </p>
      </div>

      {error && (
        <div className="module-card module-error">
          <strong>Roles & permissions unavailable</strong>
          <p>{error}</p>
        </div>
      )}

      {notice && (
        <div className="admin-notice">
          <strong>{notice}</strong>
        </div>
      )}

      <div className="stats-grid administrator-stats">
        <div className="stat-card">
          <span>Administrators</span>
          <strong>{roles.length}</strong>
          <small>Authorization records</small>
        </div>

        <div className="stat-card">
          <span>Selected Access</span>
          <strong>{assignedCount}</strong>
          <small>Assigned administration modules</small>
        </div>

        <div className="stat-card">
          <span>Super Administrators</span>
          <strong>
            {roles.filter((role) => role.isSuperAdministrator).length}
          </strong>
          <small>Protected accounts</small>
        </div>

        <div className="stat-card">
          <span>Authorization Boundary</span>
          <strong>RBAC</strong>
          <small>Backend enforced</small>
        </div>
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

        <button
          type="button"
          className="refresh-button"
          onClick={() => void loadRoles()}
          disabled={loading}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <div className="administrator-layout">
        <div className="administrator-directory panel">
          <div className="panel-header">
            <div>
              <h2>Administrative Roles</h2>
              <p>
                {filteredRoles.length} administrator
                {filteredRoles.length === 1 ? "" : "s"} shown
              </p>
            </div>
          </div>

          {loading ? (
            <div className="administrator-empty">
              <strong>Loading roles…</strong>
            </div>
          ) : filteredRoles.length === 0 ? (
            <div className="administrator-empty">
              <strong>No administrators found</strong>
              <span>
                Adjust the search or verify that authorization records
                exist.
              </span>
            </div>
          ) : (
            <div className="administrator-list">
              {filteredRoles.map((role) => {
                const name =
                  `${role.user.firstName} ${role.user.lastName}`.trim();

                return (
                  <button
                    type="button"
                    key={role.userId}
                    className={`administrator-row ${
                      selected?.userId === role.userId
                        ? "administrator-row-selected"
                        : ""
                    }`}
                    onClick={() => void selectRole(role)}
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
                      <strong>
                        {name || "Unnamed Administrator"}
                      </strong>

                      <span>
                        {role.user.email ?? "No email"}
                      </span>

                      <small>
                        {role.isSuperAdministrator
                          ? "Super Administrator"
                          : labelize(role.administratorType)}
                      </small>
                    </div>

                    <span
                      className={`administrator-status administrator-status-${role.status.toLowerCase()}`}
                    >
                      {role.status}
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
              <h2>Permission Profile</h2>

              <p>
                {selected
                  ? "Administrative access configuration"
                  : "Select an administrator"}
              </p>
            </div>
          </div>

          {!selected ? (
            <div className="administrator-empty detail-empty">
              <div className="placeholder-icon">P</div>

              <strong>Select an administrator</strong>

              <span>
                Choose an administrator to inspect and manage
                administration module access.
              </span>
            </div>
          ) : detailLoading ? (
            <div className="administrator-empty">
              <strong>Loading permissions…</strong>
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
                    {selected.user.firstName}{" "}
                    {selected.user.lastName}
                  </h3>

                  <span>
                    {selected.user.email ?? "No email address"}
                  </span>
                </div>
              </div>

              {selected.isSuperAdministrator ? (
                <div className="super-admin-banner">
                  <strong>Super Administrator</strong>

                  <span>
                    This account is protected by the platform's
                    Super Administrator authorization boundary.
                    Permission editing is disabled.
                  </span>
                </div>
              ) : (
                <>
                  <div className="administrator-meta-grid">
                    <div>
                      <span>Administrator Type</span>
                      <strong>
                        {labelize(selected.administratorType)}
                      </strong>
                    </div>

                    <div>
                      <span>Account Status</span>
                      <strong
                        className={`administrator-status administrator-status-${selected.status.toLowerCase()}`}
                      >
                        {selected.status}
                      </strong>
                    </div>

                    <div>
                      <span>Assigned Modules</span>
                      <strong>{assignedCount}</strong>
                    </div>

                    <div>
                      <span>Two-Factor Authentication</span>
                      <strong>
                        {selected.twoFactorEnabled
                          ? "Enabled"
                          : "Not enabled"}
                      </strong>
                    </div>
                  </div>

                  <div className="administrator-edit-section">
                    <div className="administrator-section-heading">
                      <div>
                        <strong>Permission Assignment</strong>

                        <span>
                          Select the Administration Management
                          modules this administrator may access.
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
                            checked={selectedModules.includes(module)}
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
                      disabled={saving || assignedCount === 0}
                      onClick={() => void savePermissions()}
                    >
                      {saving ? "Saving…" : "Save Permissions"}
                    </button>
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
