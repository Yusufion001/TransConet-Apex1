import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createMarketingCampaign,
  getMarketingCampaign,
  getMarketingCampaigns,
  updateMarketingCampaign,
  updateMarketingCampaignStatus,
  type MarketingCampaign,
  type MarketingCampaignCreate,
} from "../api/marketing";

function statusClass(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function labelize(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function formatBudget(value: number | string | null) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const amount = Number(value);

  if (Number.isNaN(amount)) {
    return String(value);
  }

  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const channels = [
  "MOBILE_HOME",
  "MOBILE_BANNER",
  "PUSH",
  "EMAIL",
  "SMS",
];

const statuses = [
  "DRAFT",
  "SCHEDULED",
  "ACTIVE",
  "PAUSED",
  "COMPLETED",
  "CANCELLED",
];

export default function MarketingCenter() {
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([]);
  const [selected, setSelected] = useState<MarketingCampaign | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [channelFilter, setChannelFilter] = useState("");

  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [creating, setCreating] = useState(false);

  const [form, setForm] = useState<MarketingCampaignCreate>({
    name: "",
    description: "",
    channel: "MOBILE_HOME",
    audience: "CUSTOMERS",
    status: "DRAFT",
    budget: undefined,
    startDate: "",
    endDate: "",
    content: {},
  });

  const loadCampaigns = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const result = await getMarketingCampaigns({
        status: statusFilter || undefined,
        channel: channelFilter || undefined,
      });

      setCampaigns(result);
    } catch {
      setError("Unable to load marketing campaigns.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, channelFilter]);

  async function openCampaign(id: string) {
    try {
      setDetailLoading(true);
      setError("");

      const campaign = await getMarketingCampaign(id);

      setSelected(campaign);

      setForm({
        name: campaign.name,
        description: campaign.description ?? "",
        channel: campaign.channel,
        audience: campaign.audience,
        status: campaign.status,
        budget:
          campaign.budget === null
            ? undefined
            : Number(campaign.budget),
        startDate: campaign.startDate ?? "",
        endDate: campaign.endDate ?? "",
        content: campaign.content ?? {},
      });
    } catch {
      setError("Unable to load campaign details.");
    } finally {
      setDetailLoading(false);
    }
  }

  function updateForm<K extends keyof MarketingCampaignCreate>(
    key: K,
    value: MarketingCampaignCreate[K],
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function saveCampaign() {
    if (!form.name.trim()) {
      setError("Campaign name is required.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const payload = {
        ...form,
        name: form.name.trim(),
        description: form.description?.trim() || undefined,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
      };

      const updated = selected
        ? await updateMarketingCampaign(selected.id, payload)
        : await createMarketingCampaign(payload);

      setSelected(updated);
      setCreating(false);

      await loadCampaigns();
      await openCampaign(updated.id);
    } catch {
      setError(
        selected
          ? "Unable to update campaign."
          : "Unable to create campaign.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(status: string) {
    if (!selected) return;

    try {
      setSaving(true);
      setError("");

      const updated = await updateMarketingCampaignStatus(
        selected.id,
        status,
      );

      setSelected(updated);

      setCampaigns((current) =>
        current.map((campaign) =>
          campaign.id === updated.id ? updated : campaign,
        ),
      );
    } catch {
      setError("Unable to update campaign status.");
    } finally {
      setSaving(false);
    }
  }

  function startCreating() {
    setSelected(null);
    setCreating(true);
    setError("");

    setForm({
      name: "",
      description: "",
      channel: "MOBILE_HOME",
      audience: "CUSTOMERS",
      status: "DRAFT",
      budget: undefined,
      startDate: "",
      endDate: "",
      content: {},
    });
  }

  useEffect(() => {
    // Intentional: synchronize component state with the backend API.
    void loadCampaigns();
  }, [loadCampaigns]);

  const filteredCampaigns = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return campaigns;

    return campaigns.filter((campaign) =>
      [
        campaign.name,
        campaign.description,
        campaign.channel,
        campaign.audience,
        campaign.status,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(query),
        ),
    );
  }, [campaigns, search]);

  const activeCount = campaigns.filter(
    (campaign) => campaign.status === "ACTIVE",
  ).length;

  const scheduledCount = campaigns.filter(
    (campaign) => campaign.status === "SCHEDULED",
  ).length;

  const draftCount = campaigns.filter(
    (campaign) => campaign.status === "DRAFT",
  ).length;

  if (selected || creating) {
    return (
      <section className="dashboard">
        <div className="module-header">
          <div>
            <button
              type="button"
              className="customer-back-button"
              onClick={() => {
                setSelected(null);
                setCreating(false);
                setError("");
              }}
            >
              ← Marketing Center
            </button>

            <div className="module-kicker">
              TRANSCONET-APEX1 / MARKETING CENTER
            </div>

            <h2>
              {selected
                ? selected.name
                : "Create Campaign"}
            </h2>

            <p>
              Build and control TransConet campaigns across
              customer and transporter channels.
            </p>
          </div>

          {selected && (
            <span
              className={`status-pill ${statusClass(
                selected.status,
              )}`}
            >
              {labelize(selected.status)}
            </span>
          )}
        </div>

        {error && (
          <div className="panel customer-state error-state">
            {error}
          </div>
        )}

        {detailLoading ? (
          <div className="panel customer-state">
            Loading campaign…
          </div>
        ) : (
          <div className="customer-layout">
            <aside className="customer-subnav panel">
              <div className="customer-identity">
                <div className="customer-avatar">
                  MC
                </div>

                <strong>
                  {selected?.name || "New Campaign"}
                </strong>

                <span>
                  {labelize(form.channel)}
                </span>

                <span>
                  {labelize(form.audience)}
                </span>
              </div>

              {selected && (
                <div className="customer-actions">
                  <strong>Campaign Control</strong>

                  {statuses
                    .filter(
                      (status) => status !== selected.status,
                    )
                    .slice(0, 4)
                    .map((status) => (
                      <button
                        key={status}
                        type="button"
                        className="secondary-button"
                        disabled={saving}
                        onClick={() =>
                          void changeStatus(status)
                        }
                      >
                        {labelize(status)}
                      </button>
                    ))}
                </div>
              )}
            </aside>

            <div className="customer-content">
              <div className="section-title">
                <h3>Campaign Configuration</h3>
                <span>
                  Audience, channel, content and campaign lifecycle
                </span>
              </div>

              <div className="panel customer-detail-panel">
                <div className="form-grid">
                  <label>
                    <span>Campaign Name</span>
                    <input
                      value={form.name}
                      onChange={(event) =>
                        updateForm("name", event.target.value)
                      }
                      placeholder="Campaign name"
                    />
                  </label>

                  <label>
                    <span>Audience</span>
                    <select
                      value={form.audience}
                      onChange={(event) =>
                        updateForm(
                          "audience",
                          event.target.value,
                        )
                      }
                    >
                      <option value="CUSTOMERS">
                        Customers
                      </option>
                      <option value="TRANSPORTERS">
                        Transporters
                      </option>
                      <option value="ALL">
                        All Users
                      </option>
                    </select>
                  </label>

                  <label>
                    <span>Channel</span>
                    <select
                      value={form.channel}
                      onChange={(event) =>
                        updateForm(
                          "channel",
                          event.target.value,
                        )
                      }
                    >
                      {channels.map((channel) => (
                        <option
                          key={channel}
                          value={channel}
                        >
                          {labelize(channel)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <span>Status</span>
                    <select
                      value={form.status}
                      onChange={(event) =>
                        updateForm(
                          "status",
                          event.target.value,
                        )
                      }
                    >
                      {statuses.map((status) => (
                        <option
                          key={status}
                          value={status}
                        >
                          {labelize(status)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <span>Budget</span>
                    <input
                      type="number"
                      min="0"
                      value={form.budget ?? ""}
                      onChange={(event) =>
                        updateForm(
                          "budget",
                          event.target.value
                            ? Number(event.target.value)
                            : undefined,
                        )
                      }
                      placeholder="Campaign budget"
                    />
                  </label>

                  <label>
                    <span>Start Date</span>
                    <input
                      type="datetime-local"
                      value={form.startDate ?? ""}
                      onChange={(event) =>
                        updateForm(
                          "startDate",
                          event.target.value,
                        )
                      }
                    />
                  </label>

                  <label>
                    <span>End Date</span>
                    <input
                      type="datetime-local"
                      value={form.endDate ?? ""}
                      onChange={(event) =>
                        updateForm(
                          "endDate",
                          event.target.value,
                        )
                      }
                    />
                  </label>

                  <label className="form-grid-wide">
                    <span>Description</span>
                    <textarea
                      rows={4}
                      value={form.description ?? ""}
                      onChange={(event) =>
                        updateForm(
                          "description",
                          event.target.value,
                        )
                      }
                      placeholder="Describe the campaign..."
                    />
                  </label>
                </div>

                <div className="section-title">
                  <h3>Campaign Content</h3>
                  <span>
                    Content payload delivered through the selected
                    marketing channel
                  </span>
                </div>

                <textarea
                  rows={8}
                  value={JSON.stringify(
                    form.content ?? {},
                    null,
                    2,
                  )}
                  onChange={(event) => {
                    try {
                      updateForm(
                        "content",
                        JSON.parse(event.target.value),
                      );
                    } catch {
                      // Preserve the editor until valid JSON is entered.
                    }
                  }}
                  className="code-editor"
                />

                <div className="customer-actions">
                  <button
                    type="button"
                    className="primary-button"
                    disabled={saving}
                    onClick={() => void saveCampaign()}
                  >
                    {saving
                      ? "Saving…"
                      : selected
                        ? "Save Campaign"
                        : "Create Campaign"}
                  </button>

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      setSelected(null);
                      setCreating(false);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>

              {selected && (
                <div className="panel customer-detail-panel">
                  <div className="section-title">
                    <h3>Campaign Intelligence</h3>
                    <span>
                      Current campaign metadata and delivery state
                    </span>
                  </div>

                  <div className="detail-grid">
                    <div>
                      <span>Campaign ID</span>
                      <strong>{selected.id}</strong>
                    </div>

                    <div>
                      <span>Status</span>
                      <strong>
                        {labelize(selected.status)}
                      </strong>
                    </div>

                    <div>
                      <span>Channel</span>
                      <strong>
                        {labelize(selected.channel)}
                      </strong>
                    </div>

                    <div>
                      <span>Audience</span>
                      <strong>
                        {labelize(selected.audience)}
                      </strong>
                    </div>

                    <div>
                      <span>Budget</span>
                      <strong>
                        {formatBudget(selected.budget)}
                      </strong>
                    </div>

                    <div>
                      <span>Created</span>
                      <strong>
                        {formatDate(selected.createdAt)}
                      </strong>
                    </div>

                    <div>
                      <span>Start</span>
                      <strong>
                        {formatDate(selected.startDate)}
                      </strong>
                    </div>

                    <div>
                      <span>End</span>
                      <strong>
                        {formatDate(selected.endDate)}
                      </strong>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="dashboard">
      <div className="module-header">
        <div>
          <div className="module-kicker">
            TRANSCONET-APEX1 / MARKETING CENTER
          </div>
          <h2>Marketing Center</h2>
          <p>
            Orchestrate campaigns, audience communication and
            platform growth from one operational workspace.
          </p>
        </div>

        <button
          type="button"
          className="primary-button"
          onClick={startCreating}
        >
          + Create Campaign
        </button>
      </div>

      {error && (
        <div className="panel customer-state error-state">
          {error}
        </div>
      )}

      <div className="stats-grid">
        <StatCard
          label="Total Campaigns"
          value={loading ? "…" : String(campaigns.length)}
          detail="Campaign records"
        />
        <StatCard
          label="Active"
          value={loading ? "…" : String(activeCount)}
          detail="Currently active campaigns"
        />
        <StatCard
          label="Scheduled"
          value={loading ? "…" : String(scheduledCount)}
          detail="Upcoming campaigns"
        />
        <StatCard
          label="Drafts"
          value={loading ? "…" : String(draftCount)}
          detail="Campaigns awaiting activation"
        />
      </div>

      <div className="panel">
        <div className="operations-toolbar">
          <div>
            <strong>Campaign Directory</strong>
            <span>
              {filteredCampaigns.length} campaign
              {filteredCampaigns.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="operations-controls">
            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search campaigns..."
            />

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value)
              }
            >
              <option value="">All statuses</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {labelize(status)}
                </option>
              ))}
            </select>

            <select
              value={channelFilter}
              onChange={(event) =>
                setChannelFilter(event.target.value)
              }
            >
              <option value="">All channels</option>
              {channels.map((channel) => (
                <option key={channel} value={channel}>
                  {labelize(channel)}
                </option>
              ))}
            </select>

            <button
              type="button"
              className="refresh-button"
              disabled={loading}
              onClick={() => void loadCampaigns()}
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>

        <div className="operations-table-wrap">
          <table className="operations-table">
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Audience</th>
                <th>Channel</th>
                <th>Status</th>
                <th>Budget</th>
                <th>Schedule</th>
              </tr>
            </thead>

            <tbody>
              {filteredCampaigns.map((campaign) => (
                <tr
                  key={campaign.id}
                  className="selected-row"
                  onClick={() =>
                    void openCampaign(campaign.id)
                  }
                >
                  <td>
                    <strong>{campaign.name}</strong>
                    <small>
                      {campaign.description || "No description"}
                    </small>
                  </td>

                  <td>{labelize(campaign.audience)}</td>

                  <td>{labelize(campaign.channel)}</td>

                  <td>
                    <span
                      className={`status-pill ${statusClass(
                        campaign.status,
                      )}`}
                    >
                      {labelize(campaign.status)}
                    </span>
                  </td>

                  <td>
                    {formatBudget(campaign.budget)}
                  </td>

                  <td>
                    <small>
                      {formatDate(campaign.startDate)}
                    </small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!loading && filteredCampaigns.length === 0 && (
            <div className="empty-activity">
              <div className="empty-icon">MC</div>
              <strong>No campaigns found</strong>
              <span>
                Create a campaign or adjust the current filters.
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}
