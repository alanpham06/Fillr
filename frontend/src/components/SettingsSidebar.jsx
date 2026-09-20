import { useState } from "react";

const TABS = [
  ["input", "Input"],
  ["settings", "Settings"],
  ["notes", "Notes"],
];

export default function SettingsSidebar({
  fileName,
  pageCount,
  settings,
  onSettingsChange,
  onFileChosen,
  onReplaceClick,
  onClear,
  onGenerate,
  onDownload,
  generating,
  canGenerate,
  canDownload,
  fileInputRef,
  notesInputRef,
  canUploadNotes,
  uploadingNotes,
  filledFileName,
  onNotesChosen,
}) {
  const [tab, setTab] = useState("input");

  function update(partial) {
    onSettingsChange({ ...settings, ...partial });
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-tabs">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`sidebar-tab${tab === id ? " is-active" : ""}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="sidebar-body">
        {tab === "input" ? (
          <section>
            <p className="field-label">Upload PDF</p>
            <p className="muted">
              Upload a PDF or a photo of slides, notes, or a textbook chapter.
            </p>

            <input
              ref={fileInputRef}
              className="sr-only"
              type="file"
              accept="application/pdf,.pdf,image/png,image/jpeg,.png,.jpg,.jpeg,.webp"
              onChange={(event) => {
                const next = event.target.files?.[0];
                if (next) {
                  onFileChosen(next);
                }
                event.target.value = "";
              }}
            />

            {fileName ? (
              <div className="file-chip">
                <div>
                  <strong>{fileName}</strong>
                  <span>
                    {pageCount ? `${pageCount} page${pageCount === 1 ? "" : "s"}` : "PDF ready"}
                  </span>
                </div>
                <div className="chip-actions">
                  <button type="button" className="ghost" onClick={onReplaceClick}>
                    Replace
                  </button>
                  <button type="button" className="ghost" onClick={onClear}>
                    Clear
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="dropzone"
                onClick={onReplaceClick}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const next = event.dataTransfer.files?.[0];
                  if (next) {
                    onFileChosen(next);
                  }
                }}
              >
                <svg
                  className="dropzone-icon"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <strong>
                  <span className="dropzone-accent">Click to upload</span> or drag &amp; drop
                </strong>
                <span>PDF or image · lecture slides</span>
              </button>
            )}
          </section>
        ) : null}

        {tab === "settings" ? (
          <section>
            <fieldset className="field">
              <legend className="field-label">How complete should it look?</legend>
              <div className="segmented" role="radiogroup">
                <label className={settings.density === "more_full" ? "on" : ""}>
                  <input
                    type="radio"
                    name="density"
                    value="more_full"
                    checked={settings.density === "more_full"}
                    onChange={() => update({ density: "more_full" })}
                  />
                  More filled in
                </label>
                <label className={settings.density === "less_full" ? "on" : ""}>
                  <input
                    type="radio"
                    name="density"
                    value="less_full"
                    checked={settings.density === "less_full"}
                    onChange={() => update({ density: "less_full" })}
                  />
                  More blank
                </label>
              </div>
            </fieldset>

            <fieldset className="field">
              <legend className="field-label">Text size</legend>
              <div className="segmented" role="radiogroup">
                {["small", "medium", "large"].map((size) => (
                  <label key={size} className={settings.textSize === size ? "on" : ""}>
                    <input
                      type="radio"
                      name="textSize"
                      value={size}
                      checked={settings.textSize === size}
                      onChange={() => update({ textSize: size })}
                    />
                    {size[0].toUpperCase() + size.slice(1)}
                  </label>
                ))}
              </div>
            </fieldset>

            <p className="field-label">Include</p>
            <label className="toggle">
              <input
                type="checkbox"
                checked={settings.includeDiagrams}
                onChange={(event) => update({ includeDiagrams: event.target.checked })}
              />
              <span>Diagram slots</span>
            </label>

            <label className="toggle">
              <input
                type="checkbox"
                checked={settings.includeCode}
                onChange={(event) => update({ includeCode: event.target.checked })}
              />
              <span>Code-block slots</span>
            </label>
          </section>
        ) : null}

        {tab === "notes" ? (
          <section>
            <p className="field-label">Completed notes</p>
            <p className="muted">
              Photograph or scan the filled sheet. We OCR the writing and drop it
              back onto the template in teal ink. Handwriting accuracy is limited.
            </p>
            {canUploadNotes ? (
              <>
                <input
                  ref={notesInputRef}
                  className="sr-only"
                  type="file"
                  accept="application/pdf,.pdf,image/png,image/jpeg,.png,.jpg,.jpeg,.webp"
                  onChange={(event) => {
                    const next = event.target.files?.[0];
                    if (next) {
                      onNotesChosen(next);
                    }
                    event.target.value = "";
                  }}
                />
                <button
                  type="button"
                  className="secondary"
                  disabled={uploadingNotes}
                  onClick={() => notesInputRef.current?.click()}
                >
                  {uploadingNotes ? "Reading notes…" : "Upload completed notes"}
                </button>
                {filledFileName ? (
                  <p className="muted notes-status">Loaded {filledFileName}</p>
                ) : null}
              </>
            ) : (
              <p className="muted notes-status">Generate a template first, then upload the filled sheet.</p>
            )}
          </section>
        ) : null}
      </div>

      {tab !== "notes" ? (
        <div className="actions">
          <button
            type="button"
            className="primary"
            disabled={!canGenerate || generating}
            onClick={onGenerate}
          >
            {generating ? "Generating…" : "Generate template"}
          </button>
          <button type="button" className="secondary" disabled={!canDownload} onClick={onDownload}>
            Download template
          </button>
        </div>
      ) : null}
    </aside>
  );
}
