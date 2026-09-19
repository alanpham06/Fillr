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
}) {
  function update(partial) {
    onSettingsChange({ ...settings, ...partial });
  }

  return (
    <aside className="sidebar">
      <section className="card">
        <h2>Lecture slides</h2>
        <p className="muted">Upload a PDF of slides, notes, or a textbook chapter.</p>

        <input
          ref={fileInputRef}
          className="sr-only"
          type="file"
          accept="application/pdf,.pdf"
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
            <strong>Drop a PDF here</strong>
            <span>or click to browse</span>
          </button>
        )}
      </section>

      <section className="card">
        <h2>Template settings</h2>

        <fieldset className="field">
          <legend>How complete should it look?</legend>
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
          <legend>Text size</legend>
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

        <label className="toggle">
          <input
            type="checkbox"
            checked={settings.includeDiagrams}
            onChange={(event) => update({ includeDiagrams: event.target.checked })}
          />
          <span>Include diagram slots</span>
        </label>

        <label className="toggle">
          <input
            type="checkbox"
            checked={settings.includeCode}
            onChange={(event) => update({ includeCode: event.target.checked })}
          />
          <span>Include code-block slots</span>
        </label>
      </section>

      <div className="actions">
        <button
          type="button"
          className="primary"
          disabled={!canGenerate || generating}
          onClick={onGenerate}
        >
          {generating ? "Generating…" : "Generate template"}
        </button>
        <button
          type="button"
          className="secondary"
          disabled={!canDownload}
          onClick={onDownload}
        >
          Download PDF
        </button>
      </div>
    </aside>
  );
}
