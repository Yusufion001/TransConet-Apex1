import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  createContent,
  getContentList,
  publishContent,
  updateContent,
  type ContentItem,
  type ContentStatus,
  type ContentType,
} from "../api/content";

const CONTENT_TYPES: ContentType[] = [
  "ANNOUNCEMENT",
  "BANNER",
  "FAQ",
  "ARTICLE",
  "TERMS",
  "POLICY",
  "HELP",
];

const CONTENT_STATUSES: ContentStatus[] = [
  "DRAFT",
  "PUBLISHED",
  "ARCHIVED",
];

const emptyForm = {
  title: "",
  slug: "",
  type: "ARTICLE" as ContentType,
  summary: "",
  body: "",
  imageUrl: "",
};

export default function ContentManagement() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [selected, setSelected] = useState<ContentItem | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadContent() {
    try {
      setLoading(true);
      setError("");

      const data = await getContentList({
        type: typeFilter
          ? (typeFilter as ContentType)
          : undefined,
        status: statusFilter
          ? (statusFilter as ContentStatus)
          : undefined,
      });

      setItems(data);
    } catch {
      setError(
        "Unable to load Content Management. Check your administrator module permission.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadContent();
  }, [typeFilter, statusFilter]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return items;

    return items.filter((item) =>
      [
        item.title,
        item.slug,
        item.type,
        item.status,
        item.summary ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [items, search]);

  function startCreate() {
    setSelected(null);
    setForm(emptyForm);
    setNotice("");
    setError("");
  }

  function selectContent(item: ContentItem) {
    setSelected(item);
    setForm({
      title: item.title,
      slug: item.slug,
      type: item.type,
      summary: item.summary ?? "",
      body: item.body,
      imageUrl: item.imageUrl ?? "",
    });
    setNotice("");
    setError("");
  }

  function updateField(
    field: keyof typeof emptyForm,
    value: string,
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    try {
      setSaving(true);
      setError("");
      setNotice("");

      const payload = {
        title: form.title.trim(),
        slug: form.slug.trim(),
        type: form.type,
        summary: form.summary.trim() || undefined,
        body: form.body,
        imageUrl: form.imageUrl.trim() || undefined,
      };

      const result = selected
        ? await updateContent(selected.id, payload)
        : await createContent(payload);

      setSelected(result);
      setForm({
        title: result.title,
        slug: result.slug,
        type: result.type,
        summary: result.summary ?? "",
        body: result.body,
        imageUrl: result.imageUrl ?? "",
      });

      setNotice(
        selected
          ? "Content updated successfully."
          : "Content created as draft.",
      );

      await loadContent();
    } catch {
      setError(
        "Unable to save content. Verify the fields and your module permission.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    if (!selected) return;

    try {
      setSaving(true);
      setError("");
      setNotice("");

      const result = await publishContent(selected.id);

      setSelected(result);
      setItems((current) =>
        current.map((item) =>
          item.id === result.id ? result : item,
        ),
      );

      setNotice("Content published successfully.");
    } catch {
      setError("Unable to publish this content.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="module-workspace content-management-workspace">
      <div className="module-header">
        <span className="module-kicker">
          TRANSCONET-APEX1 GOVERNANCE
        </span>

        <h2>Content Management</h2>

        <p>
          Govern platform content, announcements, help resources,
          policies and other controlled content from one
          administration workspace.
        </p>
      </div>

      {error && (
        <div className="module-card module-error">
          <strong>Content Management unavailable</strong>
          <p>{error}</p>
        </div>
      )}

      {notice && (
        <div className="module-card module-success">
          {notice}
        </div>
      )}

      <div className="content-management-layout">
        <div className="module-card content-library">
          <div className="panel-header">
            <div>
              <h2>Content Library</h2>
              <p>
                {filteredItems.length} content item
                {filteredItems.length === 1 ? "" : "s"}
              </p>
            </div>

            <button
              type="button"
              className="primary-button"
              onClick={startCreate}
            >
              + New Content
            </button>
          </div>

          <div className="content-filters">
            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search content..."
            />

            <select
              value={typeFilter}
              onChange={(event) =>
                setTypeFilter(event.target.value)
              }
            >
              <option value="">All types</option>
              {CONTENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value)
              }
            >
              <option value="">All statuses</option>
              {CONTENT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>

            <button
              type="button"
              className="refresh-button"
              onClick={() => void loadContent()}
              disabled={loading}
            >
              {loading ? "Loading…" : "Refresh"}
            </button>
          </div>

          <div className="content-list">
            {loading ? (
              <div className="empty-activity">
                <strong>Loading content…</strong>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="empty-activity">
                <strong>No content found</strong>
                <span>
                  Create the first controlled platform content item.
                </span>
              </div>
            ) : (
              filteredItems.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={`content-list-item ${
                    selected?.id === item.id ? "selected" : ""
                  }`}
                  onClick={() => selectContent(item)}
                >
                  <div>
                    <strong>{item.title}</strong>
                    <span>{item.slug}</span>
                  </div>

                  <div className="content-list-meta">
                    <span className={`content-status ${item.status.toLowerCase()}`}>
                      {item.status}
                    </span>
                    <small>{item.type}</small>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <form
          className="module-card content-editor"
          onSubmit={handleSubmit}
        >
          <div className="panel-header">
            <div>
              <h2>
                {selected ? "Edit Content" : "Create Content"}
              </h2>
              <p>
                {selected
                  ? "Modify the selected content item."
                  : "New content starts in draft status."}
              </p>
            </div>

            {selected && (
              <span className={`content-status ${selected.status.toLowerCase()}`}>
                {selected.status}
              </span>
            )}
          </div>

          <label>
            <span>Title</span>
            <input
              value={form.title}
              onChange={(event) =>
                updateField("title", event.target.value)
              }
              maxLength={200}
              required
            />
          </label>

          <label>
            <span>Slug</span>
            <input
              value={form.slug}
              onChange={(event) =>
                updateField("slug", event.target.value)
              }
              maxLength={200}
              required
            />
          </label>

          <label>
            <span>Content Type</span>
            <select
              value={form.type}
              onChange={(event) =>
                updateField(
                  "type",
                  event.target.value as ContentType,
                )
              }
            >
              {CONTENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Summary</span>
            <textarea
              value={form.summary}
              onChange={(event) =>
                updateField("summary", event.target.value)
              }
              maxLength={1000}
              rows={3}
            />
          </label>

          <label>
            <span>Body</span>
            <textarea
              value={form.body}
              onChange={(event) =>
                updateField("body", event.target.value)
              }
              rows={12}
              required
            />
          </label>

          <label>
            <span>Image URL</span>
            <input
              value={form.imageUrl}
              onChange={(event) =>
                updateField("imageUrl", event.target.value)
              }
              type="url"
            />
          </label>

          <div className="editor-actions">
            <button
              type="submit"
              className="primary-button"
              disabled={saving}
            >
              {saving
                ? "Saving…"
                : selected
                  ? "Save Changes"
                  : "Create Draft"}
            </button>

            {selected &&
              selected.status !== "PUBLISHED" && (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => void handlePublish()}
                  disabled={saving}
                >
                  Publish
                </button>
              )}
          </div>
        </form>
      </div>
    </section>
  );
}
