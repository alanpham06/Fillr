import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import PdfPane from "../components/PdfPane.jsx";
import SettingsSidebar from "../components/SettingsSidebar.jsx";
import { useAppSession } from "../context/AppSession.jsx";

function workspaceQuery(doc) {
  const params = new URLSearchParams({
    kind: doc.kind,
    id: doc.id,
    title: doc.title,
    filename: doc.filename,
    pageCount: String(doc.pageCount || 1),
  });
  return `/editor?${params.toString()}`;
}

export default function CreatePage() {
  const fileInputRef = useRef(null);
  const notesInputRef = useRef(null);
  const navigate = useNavigate();
  const session = useAppSession();
  const {
    settings,
    setSettings,
    file,
    source,
    sourceUrl,
    template,
    templateUrl,
    filled,
    filledUrl,
    filledName,
    showFilled,
    setShowFilled,
    generating,
    uploadingNotes,
    loadingMessage,
    error,
    busyLabel,
    setWorkspace,
    sessionTitle,
    setSessionTitle,
    savedFlash,
    handleFileChosen,
    handleClear,
    handleGenerate,
    handleNotesChosen,
    handleDownload,
    handleSave,
    rememberSession,
  } = session;

  const previewingFilled = Boolean(showFilled && filledUrl);

  function openWorkspace(doc) {
    rememberSession({
      title: sessionTitle || file?.name || doc.title,
    });
    setWorkspace(doc);
    navigate(workspaceQuery(doc));
  }

  return (
    <div className="create-page">
      <header className="create-toolbar">
        <div className="create-toolbar-copy">
          <input
            className="create-title"
            value={sessionTitle}
            onChange={(event) => setSessionTitle(event.target.value)}
            placeholder="Untitled notes"
            aria-label="Session title"
          />
          <p className="disclaimer">
            Generated templates may miss topics from the source slides. This is a
            fill-in note sheet, not a homework solver. Teal ink on a filled PDF
            is OCR and may misread handwriting. Open a PDF workspace to write or
            type on a page; your ink is saved in this browser.
          </p>
        </div>
        <button
          type="button"
          className="secondary create-save"
          disabled={!source && !template}
          onClick={handleSave}
        >
          {savedFlash ? "✓ Saved" : "Save"}
        </button>
      </header>

      <div className="workspace">
        <SettingsSidebar
          fileName={file?.name || ""}
          pageCount={source?.page_count || 0}
          settings={settings}
          onSettingsChange={setSettings}
          onFileChosen={handleFileChosen}
          onReplaceClick={() => fileInputRef.current?.click()}
          onClear={handleClear}
          onGenerate={handleGenerate}
          onDownload={handleDownload}
          generating={generating}
          canGenerate={Boolean(source) && !busyLabel}
          canDownload={Boolean(template)}
          fileInputRef={fileInputRef}
          notesInputRef={notesInputRef}
          canUploadNotes={Boolean(template)}
          uploadingNotes={uploadingNotes}
          filledFileName={filledName}
          onNotesChosen={handleNotesChosen}
        />

        <main className="previews">
          {error ? <div className="banner error">{error}</div> : null}
          {busyLabel ? <div className="banner info">{busyLabel}</div> : null}
          {generating ? (
            <div className="banner progress" role="status">
              <span className="spinner" />
              {loadingMessage}
            </div>
          ) : null}

          <div className="preview-grid">
            <PdfPane
              title="Uploaded slides"
              subtitle={file ? file.name : "Waiting for a file"}
              file={sourceUrl || null}
              emptyTitle="No slides yet"
              emptyBody="Upload a lecture PDF or a photo of a slide to preview it here."
              onOpenWorkspace={
                source
                  ? () =>
                      openWorkspace({
                        kind: "source",
                        id: source.id,
                        title: file?.name || "Uploaded slides",
                        filename: file?.name || "slides.pdf",
                        pageCount: source.page_count || 1,
                      })
                  : undefined
              }
            />
            <PdfPane
              title={previewingFilled ? "Filled notes" : "Generated template"}
              subtitle={
                previewingFilled
                  ? "Student ink over the printed skeleton"
                  : template
                    ? "Fill-in lecture notes"
                    : "Will appear after you generate"
              }
              file={(previewingFilled ? filledUrl : templateUrl) || null}
              emptyTitle="No template yet"
              emptyBody="Choose your settings, then generate a fill-in note sheet."
              onOpenWorkspace={
                template
                  ? () =>
                      openWorkspace({
                        kind: previewingFilled ? "filled" : "template",
                        id: template.template_id,
                        title: previewingFilled ? "Filled notes" : "Generated template",
                        filename: file
                          ? `${file.name.replace(/\.(pdf|png|jpe?g|webp)$/i, "")}-${
                              previewingFilled ? "filled" : "notes"
                            }.pdf`
                          : previewingFilled
                            ? "filled-notes.pdf"
                            : "lecture-template.pdf",
                        pageCount:
                          (previewingFilled ? filled?.page_count : template.page_count) || 1,
                      })
                  : undefined
              }
              actions={
                filledUrl ? (
                  <div className="segmented pane-toggle" role="radiogroup">
                    <label className={!showFilled ? "on" : ""}>
                      <input
                        type="radio"
                        name="previewMode"
                        checked={!showFilled}
                        onChange={() => setShowFilled(false)}
                      />
                      Template
                    </label>
                    <label className={showFilled ? "on" : ""}>
                      <input
                        type="radio"
                        name="previewMode"
                        checked={showFilled}
                        onChange={() => setShowFilled(true)}
                      />
                      Filled
                    </label>
                  </div>
                ) : null
              }
            />
          </div>
        </main>
      </div>
    </div>
  );
}
