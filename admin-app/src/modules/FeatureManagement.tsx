import { useEffect, useMemo, useState } from "react";
import {
  createFeatureFlag,
  getFeatureFlags,
  setFeatureFlagEnabled,
  updateFeatureFlag,
  type FeatureFlag,
  type FeatureFlagCreate,
  type FeatureVisibility,
} from "../api/features";

function labelize(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export default function FeatureManagement() {
  const [features, setFeatures] = useState<FeatureFlag[]>([]);
  const [selected, setSelected] = useState<FeatureFlag | null>(null);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState<FeatureFlagCreate>({
    key: "",
    name: "",
    description: "",
    enabled: false,
    visibility: "INTERNAL",
    rolloutPercentage: 100,
    customerEnabled: true,
    transporterEnabled: true,
    metadata: {},
  });

  async function loadFeatures() {
    try {
      setLoading(true);
      setError("");
      setFeatures(await getFeatureFlags());
    } catch {
      setError("Unable to load feature flags.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadFeatures();
  }, []);

  function startCreating() {
    setSelected(null);
    setCreating(true);
    setError("");

    setForm({
      key: "",
      name: "",
      description: "",
      enabled: false,
      visibility: "INTERNAL",
      rolloutPercentage: 100,
      customerEnabled: true,
      transporterEnabled: true,
      metadata: {},
    });
  }

  function openFeature(feature: FeatureFlag) {
    setSelected(feature);
    setCreating(false);
    setError("");

    setForm({
      key: feature.key,
      name: feature.name,
      description: feature.description ?? "",
      enabled: feature.enabled,
      visibility: feature.visibility,
      rolloutPercentage: feature.rolloutPercentage,
      customerEnabled: feature.customerEnabled,
      transporterEnabled: feature.transporterEnabled,
      metadata: feature.metadata ?? {},
    });
  }

  function updateForm<K extends keyof FeatureFlagCreate>(
    key: K,
    value: FeatureFlagCreate[K],
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function saveFeature() {
    if (!form.name?.trim()) {
      setError("Feature name is required.");
      return;
    }

    if (creating && !form.key?.trim()) {
      setError("Feature key is required.");
      return;
    }

    const rollout = Number(form.rolloutPercentage);

    if (
      !Number.isInteger(rollout) ||
      rollout < 0 ||
      rollout > 100
    ) {
      setError("Rollout percentage must be an integer from 0 to 100.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      if (creating) {
        const created = await createFeatureFlag({
          ...form,
          key: form.key!.trim().toUpperCase(),
          name: form.name!.trim(),
          description: form.description?.trim() || undefined,
          rolloutPercentage: rollout,
        });

        setSelected(created);
        setCreating(false);
      } else if (selected) {
        const updated = await updateFeatureFlag(selected.key, {
          name: form.name!.trim(),
          description: form.description?.trim() || null,
          enabled: Boolean(form.enabled),
          visibility: form.visibility,
          rolloutPercentage: rollout,
          customerEnabled: Boolean(form.customerEnabled),
          transporterEnabled: Boolean(form.transporterEnabled),
          metadata: form.metadata ?? {},
        });

        setSelected(updated);
      }

      await loadFeatures();
    } catch {
      setError(
        creating
          ? "Unable to create feature flag."
          : "Unable to update feature flag.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleFeature(feature: FeatureFlag) {
    try {
      setError("");

      const updated = await setFeatureFlagEnabled(
        feature.key,
        !feature.enabled,
      );

      setFeatures((current) =>
        current.map((item) =>
          item.id === updated.id ? updated : item,
        ),
      );

      if (selected?.id === updated.id) {
        setSelected(updated);
        setForm((current) => ({
          ...current,
          enabled: updated.enabled,
        }));
      }
    } catch {
      setError("Unable to change feature state.");
    }
  }

  const filteredFeatures = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return features;

    return features.filter((feature) =>
      [
        feature.key,
        feature.name,
        feature.description,
        feature.visibility,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(query),
        ),
    );
  }, [features, search]);

  const enabledCount = features.filter(
    (feature) => feature.enabled,
  ).length;

  const publicCount = features.filter(
    (feature) => feature.visibility === "PUBLIC",
  ).length;

  const customerCount = features.filter(
    (feature) => feature.customerEnabled,
  ).length;

  const transporterCount = features.filter(
    (feature) => feature.transporterEnabled,
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
              ← Feature Management
            </button>

            <h2>
              {creating
                ? "Create Feature"
                : "Feature Configuration"}
            </h2>

            <p>
              Control feature availability, audience access and
              controlled rollout across TransConet-Apex1.
            </p>
          </div>
        </div>

        {error && (
          <div className="error-banner">
            {error}
          </div>
        )}

        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>
                {creating
                  ? "New Feature Flag"
                  : form.name || form.key}
              </h2>
              <p>
                Runtime configuration is enforced by the backend
                feature evaluation service.
              </p>
            </div>

            {!creating && selected && (
              <button
                type="button"
                className="secondary-button"
                onClick={() => void toggleFeature(selected)}
              >
                {selected.enabled ? "Disable" : "Enable"}
              </button>
            )}
          </div>

          <div className="form-grid">
            {creating && (
              <label>
                Feature Key
                <input
                  value={form.key}
                  placeholder="EXAMPLE_FEATURE"
                  onChange={(event) =>
                    updateForm(
                      "key",
                      event.target.value.toUpperCase(),
                    )
                  }
                />
              </label>
            )}

            <label>
              Name
              <input
                value={form.name}
                placeholder="Feature name"
                onChange={(event) =>
                  updateForm("name", event.target.value)
                }
              />
            </label>

            <label className="form-grid-full">
              Description
              <textarea
                value={form.description ?? ""}
                placeholder="Describe what this feature controls"
                onChange={(event) =>
                  updateForm(
                    "description",
                    event.target.value,
                  )
                }
              />
            </label>

            <label>
              Visibility
              <select
                value={form.visibility}
                onChange={(event) =>
                  updateForm(
                    "visibility",
                    event.target.value as FeatureVisibility,
                  )
                }
              >
                <option value="INTERNAL">Internal</option>
                <option value="PUBLIC">Public</option>
              </select>
            </label>

            <label>
              Rollout Percentage
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                value={form.rolloutPercentage ?? 100}
                onChange={(event) =>
                  updateForm(
                    "rolloutPercentage",
                    Number(event.target.value),
                  )
                }
              />
            </label>

            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={Boolean(form.enabled)}
                onChange={(event) =>
                  updateForm(
                    "enabled",
                    event.target.checked,
                  )
                }
              />
              <span>Feature enabled</span>
            </label>

            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={Boolean(form.customerEnabled)}
                onChange={(event) =>
                  updateForm(
                    "customerEnabled",
                    event.target.checked,
                  )
                }
              />
              <span>Available to customers</span>
            </label>

            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={Boolean(form.transporterEnabled)}
                onChange={(event) =>
                  updateForm(
                    "transporterEnabled",
                    event.target.checked,
                  )
                }
              />
              <span>Available to transporters</span>
            </label>
          </div>

          <div className="module-actions">
            <button
              type="button"
              className="primary-button"
              disabled={saving}
              onClick={() => void saveFeature()}
            >
              {saving
                ? "Saving..."
                : creating
                  ? "Create Feature"
                  : "Save Changes"}
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setSelected(null);
                setCreating(false);
                setError("");
              }}
            >
              Cancel
            </button>
          </div>

          {selected && (
            <div className="module-meta">
              <span>
                Key: <strong>{selected.key}</strong>
              </span>
              <span>
                Created: {formatDate(selected.createdAt)}
              </span>
              <span>
                Updated: {formatDate(selected.updatedAt)}
              </span>
            </div>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="dashboard">
      <div className="module-header">
        <div>
          <span className="eyebrow">
            PLATFORM GOVERNANCE
          </span>
          <h2>Feature Management</h2>
          <p>
            Govern controlled feature releases across the
            TransConet-Apex1 ecosystem.
          </p>
        </div>

        <button
          type="button"
          className="primary-button"
          onClick={startCreating}
        >
          + Create Feature
        </button>
      </div>

      {error && (
        <div className="error-banner">
          {error}
        </div>
      )}

      <section className="stats-grid">
        <Stat label="Total Features" value={features.length} />
        <Stat label="Enabled" value={enabledCount} />
        <Stat label="Public" value={publicCount} />
        <Stat label="Customer Ready" value={customerCount} />
        <Stat label="Transporter Ready" value={transporterCount} />
      </section>

      <div className="panel">
        <div className="panel-header">
          <div>
            <h2>Feature Flags</h2>
            <p>
              Runtime controls currently configured on the
              platform.
            </p>
          </div>

          <input
            className="module-search"
            placeholder="Search features..."
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
          />
        </div>

        {loading ? (
          <div className="empty-state">
            Loading feature flags...
          </div>
        ) : filteredFeatures.length === 0 ? (
          <div className="empty-state">
            No feature flags found.
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>Visibility</th>
                  <th>Rollout</th>
                  <th>Customer</th>
                  <th>Transporter</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>

              <tbody>
                {filteredFeatures.map((feature) => (
                  <tr key={feature.id}>
                    <td>
                      <button
                        type="button"
                        className="table-link"
                        onClick={() =>
                          openFeature(feature)
                        }
                      >
                        <strong>{feature.name}</strong>
                        <span>{feature.key}</span>
                      </button>
                    </td>

                    <td>
                      <span className="status-badge">
                        {labelize(feature.visibility)}
                      </span>
                    </td>

                    <td>
                      {feature.rolloutPercentage}%
                    </td>

                    <td>
                      {feature.customerEnabled
                        ? "Enabled"
                        : "Disabled"}
                    </td>

                    <td>
                      {feature.transporterEnabled
                        ? "Enabled"
                        : "Disabled"}
                    </td>

                    <td>
                      <button
                        type="button"
                        className={
                          feature.enabled
                            ? "status-badge status-active"
                            : "status-badge"
                        }
                        onClick={() =>
                          void toggleFeature(feature)
                        }
                      >
                        {feature.enabled
                          ? "Enabled"
                          : "Disabled"}
                      </button>
                    </td>

                    <td>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() =>
                          openFeature(feature)
                        }
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
    </div>
  );
}
