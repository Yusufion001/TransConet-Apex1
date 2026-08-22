import { useEffect, useMemo, useState } from "react";
import {
  getPlatformConfig,
  updatePlatformConfig,
  type PlatformConfig,
  type PlatformConfigDefinition,
} from "../api/platform-config";

function formatLabel(key: string) {
  return key
    .replace(/_CONFIG$/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatValue(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "";
  }
}

function Settings() {
  const [configs, setConfigs] = useState<PlatformConfig[]>([]);
  const [definitions, setDefinitions] = useState<
    PlatformConfigDefinition[]
  >([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [editorValue, setEditorValue] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const selectedDefinition = useMemo(
    () =>
      definitions.find(
        (definition) => definition.key === selectedKey,
      ) ?? null,
    [definitions, selectedKey],
  );

  const selectedConfig = useMemo(
    () =>
      configs.find(
        (config) => config.key === selectedKey,
      ) ?? null,
    [configs, selectedKey],
  );

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);
        setError("");

        const data = await getPlatformConfig();

        if (!mounted) return;

        setConfigs(data.configs);
        setDefinitions(data.definitions);

        const firstKey =
          data.definitions[0]?.key ?? "";

        setSelectedKey(firstKey);

        const firstConfig = data.configs.find(
          (config) => config.key === firstKey,
        );

        setEditorValue(
          firstConfig
            ? formatValue(firstConfig.value)
            : "",
        );

        setDescription(
          firstConfig?.description ??
            data.definitions[0]?.description ??
            "",
        );
      } catch {
        if (mounted) {
          setError(
            "Unable to load platform configuration.",
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  function selectConfig(key: string) {
    const config = configs.find(
      (item) => item.key === key,
    );
    const definition = definitions.find(
      (item) => item.key === key,
    );

    setSelectedKey(key);
    setEditorValue(
      config ? formatValue(config.value) : "",
    );
    setDescription(
      config?.description ??
        definition?.description ??
        "",
    );
    setMessage("");
    setError("");
  }

  async function save() {
    if (!selectedDefinition?.editable) return;

    setMessage("");
    setError("");

    let parsedValue: unknown;

    try {
      parsedValue = JSON.parse(editorValue);
    } catch {
      setError(
        "Configuration must contain valid JSON.",
      );
      return;
    }

    try {
      setSaving(true);

      const updated = await updatePlatformConfig(
        selectedKey,
        parsedValue,
        description || null,
      );

      setConfigs((current) => {
        const exists = current.some(
          (config) => config.key === updated.key,
        );

        return exists
          ? current.map((config) =>
              config.key === updated.key
                ? updated
                : config,
            )
          : [...current, updated];
      });

      setEditorValue(formatValue(updated.value));
      setDescription(updated.description ?? "");
      setMessage("Configuration saved successfully.");
    } catch {
      setError(
        "Unable to save this platform configuration.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="dashboard">
        <section className="panel">
          <div className="empty-activity">
            <strong>
              Loading platform configuration…
            </strong>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <section className="welcome-panel">
        <div>
          <span className="eyebrow">
            TRANSCONET-APEX1 PLATFORM SETTINGS
          </span>

          <h2>Platform Configuration</h2>

          <p>
            Govern controlled platform behaviour from the
            configuration registry. Changes are validated by
            the backend before they are persisted.
          </p>
        </div>

        <div className="command-status">
          <span className="status-dot" />
          <span>Configuration controls active</span>
        </div>
      </section>

      {error && (
        <section className="panel">
          <div className="empty-activity">
            <strong>{error}</strong>
          </div>
        </section>
      )}

      <section className="dashboard-grid">
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Configuration Registry</h2>
              <p>
                Available controlled platform settings
              </p>
            </div>
          </div>

          <div className="health-list">
            {definitions.map((definition) => (
              <button
                key={definition.key}
                type="button"
                className={
                  selectedKey === definition.key
                    ? "text-button"
                    : "text-button"
                }
                onClick={() =>
                  selectConfig(definition.key)
                }
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "14px",
                  marginBottom: "8px",
                }}
              >
                <strong>
                  {formatLabel(definition.key)}
                </strong>

                <br />

                <span>
                  {definition.description}
                </span>
              </button>
            ))}

            {definitions.length === 0 && (
              <div className="empty-activity">
                <strong>
                  No platform configurations registered.
                </strong>
              </div>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>
                {selectedDefinition
                  ? formatLabel(selectedDefinition.key)
                  : "Configuration"}
              </h2>

              <p>
                {selectedDefinition?.description ??
                  "Select a configuration to edit."}
              </p>
            </div>
          </div>

          {selectedDefinition && (
            <>
              <label>
                Description
                <input
                  value={description}
                  onChange={(event) =>
                    setDescription(event.target.value)
                  }
                  disabled={!selectedDefinition.editable}
                  maxLength={1000}
                />
              </label>

              <label>
                Configuration value
                <textarea
                  value={editorValue}
                  onChange={(event) =>
                    setEditorValue(event.target.value)
                  }
                  disabled={!selectedDefinition.editable}
                  rows={18}
                  spellCheck={false}
                />
              </label>

              <div className="panel-header">
                <span>
                  {selectedConfig
                    ? `Last updated ${new Date(
                        selectedConfig.updatedAt,
                      ).toLocaleString()}`
                    : "Not configured yet"}
                </span>

                {selectedDefinition.editable && (
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => void save()}
                    disabled={saving}
                  >
                    {saving
                      ? "Saving…"
                      : "Save Configuration"}
                  </button>
                )}
              </div>

              {message && (
                <div className="command-status">
                  <span className="status-dot" />
                  <span>{message}</span>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}

export default Settings;
