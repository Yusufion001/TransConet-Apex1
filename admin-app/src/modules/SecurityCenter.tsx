import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getSecurityAuditLogs,
  getSecurityOverview,
  getAdministratorSecurity,
  unlockAdministrator,
  setAdministratorTwoFactor,
  type SecurityAuditLog,
  type SecurityOverview,
  type SecurityAdministrator,
} from "../api/security";
import {
  getAdministrators,
  type Administrator,
} from "../api/administrators";

function labelize(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString();
}

function actorName(log: SecurityAuditLog) {
  if (!log.administrator) return "System";

  return (
    `${log.administrator.firstName ?? ""} ${log.administrator.lastName ?? ""}`.trim() ||
    log.administrator.email ||
    "Administrator"
  );
}

function administratorName(admin: Administrator) {
  return (
    `${admin.user.firstName ?? ""} ${admin.user.lastName ?? ""}`.trim() ||
    admin.user.email ||
    "Administrator"
  );
}

function securityStatus(admin: Administrator) {
  if (admin.status !== "ACTIVE") return "Attention";
  if (admin.lockedUntil && new Date(admin.lockedUntil) > new Date()) {
    return "Locked";
  }
  if (!admin.twoFactorEnabled) return "Review";
  return "Protected";
}

export default function SecurityCenter() {
  const [overview, setOverview] = useState<SecurityOverview | null>(null);
  const [logs, setLogs] = useState<SecurityAuditLog[]>([]);
  const [administrators, setAdministrators] = useState<Administrator[]>([]);
  const [selectedAdministrator, setSelectedAdministrator] =
    useState<SecurityAdministrator | null>(null);

  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [securityFilter, setSecurityFilter] = useState("");

  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(true);
  const [administratorsLoading, setAdministratorsLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadOverview() {
    try {
      setLoading(true);
      setError("");

      const data = await getSecurityOverview();

      setOverview(data);
      setLogs(data.recentAuditLogs);
    } catch {
      setError("Unable to load Security Center overview.");
    } finally {
      setLoading(false);
    }
  }

  const loadLogs = useCallback(async () => {
    try {
      setLogsLoading(true);

      const data = await getSecurityAuditLogs({
        action: actionFilter || undefined,
        limit: 200,
      });

      setLogs(data);
    } catch {
      setError("Unable to load security audit activity.");
    } finally {
      setLogsLoading(false);
    }
  }, [actionFilter]);

  async function loadAdministrators() {
    try {
      setAdministratorsLoading(true);

      const data = await getAdministrators();

      setAdministrators(data);
    } catch {
      setError("Unable to load administrator security directory.");
    } finally {
      setAdministratorsLoading(false);
    }
  }

  async function openAdministratorSecurity(userId: string) {
    try {
      setProfileLoading(true);
      setError("");

      const data = await getAdministratorSecurity(userId);

      setSelectedAdministrator(data);
    } catch {
      setError("Unable to load administrator security profile.");
    } finally {
      setProfileLoading(false);
    }
  }

  async function refreshAll() {
    await Promise.all([
      loadOverview(),
      loadLogs(),
      loadAdministrators(),
    ]);

    if (selectedAdministrator) {
      await openAdministratorSecurity(selectedAdministrator.userId);
    }
  }

  async function unlockSelectedAdministrator() {
    if (!selectedAdministrator) return;

    try {
      setActionLoading(true);
      setError("");

      const updated = await unlockAdministrator(
        selectedAdministrator.userId,
      );

      setSelectedAdministrator(updated);

      setAdministrators((current) =>
        current.map((admin) =>
          admin.userId === updated.userId
            ? {
                ...admin,
                failedLoginAttempts: updated.failedLoginAttempts,
                lockedUntil: updated.lockedUntil,
                twoFactorEnabled: updated.twoFactorEnabled,
                status: updated.status as Administrator["status"],
              }
            : admin,
        ),
      );

      await loadOverview();
      await loadLogs();
    } catch {
      setError("Unable to unlock administrator.");
    } finally {
      setActionLoading(false);
    }
  }

  async function toggleTwoFactor() {
    if (!selectedAdministrator) return;

    try {
      setActionLoading(true);
      setError("");

      const updated = await setAdministratorTwoFactor(
        selectedAdministrator.userId,
        !selectedAdministrator.twoFactorEnabled,
      );

      setSelectedAdministrator(updated);

      setAdministrators((current) =>
        current.map((admin) =>
          admin.userId === updated.userId
            ? {
                ...admin,
                twoFactorEnabled: updated.twoFactorEnabled,
              }
            : admin,
        ),
      );

      await loadOverview();
      await loadLogs();
    } catch {
      setError("Unable to update administrator 2FA state.");
    } finally {
      setActionLoading(false);
    }
  }

  useEffect(() => {
    void loadOverview();
    void loadAdministrators();
  }, []);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  const actions = useMemo(
    () =>
      Array.from(
        new Set(logs.map((log) => log.action).filter(Boolean)),
      ).sort(),
    [logs],
  );

  const filteredAdministrators = useMemo(() => {
    const query = search.trim().toLowerCase();

    return administrators.filter((admin) => {
      const matchesSearch =
        !query ||
        [
          administratorName(admin),
          admin.user.email,
          admin.user.phone,
          admin.administratorType,
          admin.status,
        ]
          .filter(Boolean)
          .some((value) =>
            String(value).toLowerCase().includes(query),
          );

      const matchesStatus =
        !statusFilter || admin.status === statusFilter;

      const state = securityStatus(admin);

      const matchesSecurity =
        !securityFilter || state === securityFilter;

      return matchesSearch && matchesStatus && matchesSecurity;
    });
  }, [administrators, search, statusFilter, securityFilter]);

  const filteredLogs = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return logs;

    return logs.filter((log) =>
      [
        log.action,
        actorName(log),
        log.administrator?.email,
        log.affectedUser?.email,
        log.ipAddress,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(query),
        ),
    );
  }, [logs, search]);

  const lockedCount = administrators.filter(
    (admin) =>
      admin.lockedUntil &&
      new Date(admin.lockedUntil) > new Date(),
  ).length;

  const twoFactorCount = administrators.filter(
    (admin) => admin.twoFactorEnabled,
  ).length;

  const securityPosture =
    administrators.length === 0
      ? "UNKNOWN"
      : administrators.some(
            (admin) =>
              admin.status !== "ACTIVE" ||
              !admin.twoFactorEnabled ||
              Boolean(
                admin.lockedUntil &&
                  new Date(admin.lockedUntil) > new Date(),
              ),
          )
        ? "REVIEW"
        : "PROTECTED";

  return (
    <section className="dashboard security-center">
      <div className="module-header">
        <div>
          <div className="module-kicker">
            TRANSCONET-APEX1 / SECURITY CENTER
          </div>

          <h2>Security Center</h2>

          <p>
            Central security operations for administrator access,
            authentication activity, authorization boundaries and
            administrative audit history.
          </p>
        </div>

        <button
          type="button"
          className="secondary-button"
          disabled={
            loading ||
            administratorsLoading ||
            logsLoading
          }
          onClick={() => void refreshAll()}
        >
          {loading ? "Refreshing…" : "Refresh Security"}
        </button>
      </div>

      {error && (
        <div className="panel customer-state error-state">
          {error}
        </div>
      )}

      <div className="security-posture">
        <div>
          <span>Security posture</span>
          <strong
            className={
              securityPosture === "PROTECTED"
                ? "security-good"
                : securityPosture === "REVIEW"
                  ? "security-review"
                  : ""
            }
          >
            {securityPosture}
          </strong>
        </div>

        <p>
          Security posture is derived from the administrator
          security state currently exposed by the administration API.
        </p>
      </div>

      <div className="stats-grid security-stats">
        <div className="stat-card">
          <span>Active Administrators</span>
          <strong>
            {overview?.administrators.active ?? "—"}
          </strong>
          <small>Authorized administrator accounts</small>
        </div>

        <div className="stat-card">
          <span>Suspended Administrators</span>
          <strong>
            {overview?.administrators.suspended ?? "—"}
          </strong>
          <small>Accounts requiring administrative review</small>
        </div>

        <div className="stat-card">
          <span>Currently Locked</span>
          <strong>
            {overview
              ? Math.max(overview.administrators.locked, lockedCount)
              : "—"}
          </strong>
          <small>Authentication lock state</small>
        </div>

        <div className="stat-card">
          <span>2FA Enabled</span>
          <strong>
            {overview?.administrators.twoFactorEnabled ??
              twoFactorCount}
          </strong>
          <small>Administrators with additional verification</small>
        </div>
      </div>

      <div className="section-title">
        <h3>Security Control Plane</h3>
        <span>Protection layers represented by the current platform architecture</span>
      </div>

      <div className="security-controls">
        <div className="panel security-control-card">
          <span className="security-control-icon">A</span>
          <div>
            <strong>Authentication</strong>
            <p>
              Access tokens are validated as access tokens before
              protected administration requests are accepted.
            </p>
          </div>
          <b className="security-control-status">Protected</b>
        </div>

        <div className="panel security-control-card">
          <span className="security-control-icon">R</span>
          <div>
            <strong>Refresh Sessions</strong>
            <p>
              Refresh-token sessions are organized into token
              families with reuse detection.
            </p>
          </div>
          <b className="security-control-status">Protected</b>
        </div>

        <div className="panel security-control-card">
          <span className="security-control-icon">P</span>
          <div>
            <strong>Password Recovery</strong>
            <p>
              Password reset invalidates existing refresh sessions
              after a successful reset.
            </p>
          </div>
          <b className="security-control-status">Protected</b>
        </div>

        <div className="panel security-control-card">
          <span className="security-control-icon">G</span>
          <div>
            <strong>Authorization</strong>
            <p>
              Administrator status and current database role are
              authoritative for protected administration access.
            </p>
          </div>
          <b className="security-control-status">Enforced</b>
        </div>

        <div className="panel security-control-card">
          <span className="security-control-icon">L</span>
          <div>
            <strong>Audit Trail</strong>
            <p>
              Administrative security activity is available through
              the security audit-log API.
            </p>
          </div>
          <b className="security-control-status">Active</b>
        </div>

        <div className="panel security-control-card">
          <span className="security-control-icon">E</span>
          <div>
            <strong>Error Protection</strong>
            <p>
              Production responses suppress unexpected internal
              error details while preserving request correlation.
            </p>
          </div>
          <b className="security-control-status">Active</b>
        </div>
      </div>

      <div className="section-title">
        <h3>Administrator Security Directory</h3>
        <span>
          Select an administrator to inspect security state and available controls
        </span>
      </div>

      <div className="panel security-directory">
        <div className="toolbar security-toolbar">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search administrators or security activity..."
          />

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value)
            }
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="DISABLED">Disabled</option>
          </select>

          <select
            value={securityFilter}
            onChange={(event) =>
              setSecurityFilter(event.target.value)
            }
          >
            <option value="">All security states</option>
            <option value="Protected">Protected</option>
            <option value="Review">Review</option>
            <option value="Locked">Locked</option>
            <option value="Attention">Attention</option>
          </select>
        </div>

        {administratorsLoading ? (
          <div className="customer-state">
            Loading administrator security directory…
          </div>
        ) : filteredAdministrators.length === 0 ? (
          <div className="customer-state">
            No administrators match the current filters.
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table security-table">
              <thead>
                <tr>
                  <th>Administrator</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Security</th>
                  <th>Failed</th>
                  <th>2FA</th>
                  <th>Last Login</th>
                </tr>
              </thead>

              <tbody>
                {filteredAdministrators.map((admin) => {
                  const state = securityStatus(admin);

                  return (
                    <tr
                      key={admin.userId}
                      className={
                        selectedAdministrator?.userId ===
                        admin.userId
                          ? "security-selected-row"
                          : ""
                      }
                      onClick={() =>
                        void openAdministratorSecurity(
                          admin.userId,
                        )
                      }
                    >
                      <td>
                        <strong>
                          {administratorName(admin)}
                        </strong>
                        <small>{admin.user.email}</small>
                      </td>

                      <td>
                        {labelize(admin.administratorType)}
                      </td>

                      <td>
                        <span className="status-pill">
                          {labelize(admin.status)}
                        </span>
                      </td>

                      <td>
                        <span
                          className={`security-state security-state-${state.toLowerCase()}`}
                        >
                          {state}
                        </span>
                      </td>

                      <td>{admin.failedLoginAttempts}</td>

                      <td>
                        {admin.twoFactorEnabled
                          ? "Enabled"
                          : "Disabled"}
                      </td>

                      <td>
                        {formatDate(admin.lastLoginAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="security-lower-grid">
        <div>
          <div className="section-title">
            <h3>Security Activity</h3>
            <span>Administrative security events and audit history</span>
          </div>

          <div className="panel">
            <div className="toolbar">
              <select
                value={actionFilter}
                onChange={(event) =>
                  setActionFilter(event.target.value)
                }
              >
                <option value="">All actions</option>

                {actions.map((action) => (
                  <option key={action} value={action}>
                    {labelize(action)}
                  </option>
                ))}
              </select>
            </div>

            {logsLoading ? (
              <div className="customer-state">
                Loading security activity…
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="customer-state">
                No security events found.
              </div>
            ) : (
              <div className="table-wrap">
                <table className="data-table security-table">
                  <thead>
                    <tr>
                      <th>Action</th>
                      <th>Administrator</th>
                      <th>Affected User</th>
                      <th>IP</th>
                      <th>Timestamp</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredLogs.map((log) => (
                      <tr key={log.id}>
                        <td>
                          <span className="status-pill">
                            {labelize(log.action)}
                          </span>
                        </td>

                        <td>
                          <strong>{actorName(log)}</strong>
                          {log.administrator?.email && (
                            <small>
                              {log.administrator.email}
                            </small>
                          )}
                        </td>

                        <td>
                          {log.affectedUser ? (
                            <>
                              <strong>
                                {`${log.affectedUser.firstName ?? ""} ${
                                  log.affectedUser.lastName ?? ""
                                }`.trim() || "User"}
                              </strong>
                              <small>
                                {log.affectedUser.email}
                              </small>
                            </>
                          ) : (
                            "—"
                          )}
                        </td>

                        <td>{log.ipAddress ?? "—"}</td>

                        <td>{formatDate(log.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="section-title">
            <h3>Administrator Security Profile</h3>
            <span>Security controls available through the current API</span>
          </div>

          <div className="panel security-profile">
            {profileLoading ? (
              <div className="customer-state">
                Loading security profile…
              </div>
            ) : !selectedAdministrator ? (
              <div className="security-profile-empty">
                <div className="empty-icon">◉</div>
                <strong>Select an administrator</strong>
                <span>
                  Choose an administrator from the security
                  directory to inspect their current security state.
                </span>
              </div>
            ) : (
              <>
                <div className="security-profile-heading">
                  <div className="administrator-avatar-large">
                    {selectedAdministrator.user.firstName
                      ?.charAt(0)
                      .toUpperCase()}
                  </div>

                  <div>
                    <h3>
                      {selectedAdministrator.user.firstName}{" "}
                      {selectedAdministrator.user.lastName}
                    </h3>
                    <span>
                      {selectedAdministrator.user.email}
                    </span>
                  </div>
                </div>

                <div className="security-profile-state">
                  <span>Security state</span>
                  <strong>
                    {selectedAdministrator.status ===
                    "ACTIVE"
                      ? selectedAdministrator.lockedUntil &&
                        new Date(
                          selectedAdministrator.lockedUntil,
                        ) > new Date()
                        ? "LOCKED"
                        : selectedAdministrator.twoFactorEnabled
                          ? "PROTECTED"
                          : "REVIEW"
                      : "ATTENTION"}
                  </strong>
                </div>

                <div className="security-profile-grid">
                  <div>
                    <span>Administrator Type</span>
                    <strong>
                      {labelize(
                        selectedAdministrator.administratorType,
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Account Status</span>
                    <strong>
                      {labelize(selectedAdministrator.status)}
                    </strong>
                  </div>

                  <div>
                    <span>Failed Login Attempts</span>
                    <strong>
                      {selectedAdministrator.failedLoginAttempts}
                    </strong>
                  </div>

                  <div>
                    <span>Locked Until</span>
                    <strong>
                      {formatDate(
                        selectedAdministrator.lockedUntil,
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>2FA</span>
                    <strong>
                      {selectedAdministrator.twoFactorEnabled
                        ? "Enabled"
                        : "Disabled"}
                    </strong>
                  </div>

                  <div>
                    <span>Last Login</span>
                    <strong>
                      {formatDate(
                        selectedAdministrator.lastLoginAt,
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Last Administrative Action</span>
                    <strong>
                      {formatDate(
                        selectedAdministrator.lastActionAt,
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Profile Created</span>
                    <strong>
                      {formatDate(
                        selectedAdministrator.createdAt,
                      )}
                    </strong>
                  </div>
                </div>

                <div className="security-profile-actions">
                  <button
                    type="button"
                    className="refresh-button"
                    disabled={
                      actionLoading ||
                      !selectedAdministrator.lockedUntil ||
                      new Date(
                        selectedAdministrator.lockedUntil,
                      ) <= new Date()
                    }
                    onClick={() =>
                      void unlockSelectedAdministrator()
                    }
                  >
                    {actionLoading
                      ? "Updating…"
                      : "Unlock Administrator"}
                  </button>

                  <button
                    type="button"
                    className="secondary-button"
                    disabled={actionLoading}
                    onClick={() =>
                      void toggleTwoFactor()
                    }
                  >
                    {selectedAdministrator.twoFactorEnabled
                      ? "Disable 2FA"
                      : "Enable 2FA"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {overview?.synchronizedAt && (
        <p className="module-footnote">
          Security data synchronized:{" "}
          {formatDate(overview.synchronizedAt)}
        </p>
      )}
    </section>
  );
}
