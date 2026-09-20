import { useEffect, useRef, useState } from "react";
import {
  downloadTemplate,
  fetchPdfBlob,
  generateTemplate,
  ingest,
  uploadNotes,
} from "./api.js";
import PdfPane from "./components/PdfPane.jsx";
import SettingsSidebar from "./components/SettingsSidebar.jsx";
import WorkspaceScreen from "./components/WorkspaceScreen.jsx";

const DEFAULT_SETTINGS = {
  density: "more_full",
  textSize: "medium",
  includeDiagrams: true,
  includeCode: true,
};

const LOADING_MESSAGES = [
  "Reading the uploaded slides…",
  "Laying out fill-in sections…",
  "Leaving blanks for you to write…",
  "Building a printable PDF…",
];

const NOTES_ACCEPT = /\.(pdf|png|jpe?g|webp)$/i;

function isPdfFile(name) {
  return name.toLowerCase().endsWith(".pdf");
}

export default function App() {
  const fileInputRef = useRef(null);
  const notesInputRef = useRef(null);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [file, setFile] = useState(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [source, setSource] = useState(null);
  const [template, setTemplate] = useState(null);
  const [templateUrl, setTemplateUrl] = useState("");
  const [filled, setFilled] = useState(null);
  const [filledUrl, setFilledUrl] = useState("");
  const [filledName, setFilledName] = useState("");
  const [showFilled, setShowFilled] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [uploadingNotes, setUploadingNotes] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState(LOADING_MESSAGES[0]);
  const [error, setError] = useState("");
  const [busyLabel, setBusyLabel] = useState("");
  const [workspace, setWorkspace] = useState(null);

  useEffect(() => {
    return () => {
      if (sourceUrl) {
        URL.revokeObjectURL(sourceUrl);
      }
      if (templateUrl) {
        URL.revokeObjectURL(templateUrl);
      }
      if (filledUrl) {
        URL.revokeObjectURL(filledUrl);
      }
    };
  }, [sourceUrl, templateUrl, filledUrl]);

  useEffect(() => {
    if (!generating) {
      return undefined;
    }
    let index = 0;
    setLoadingMessage(LOADING_MESSAGES[0]);
    const timer = window.setInterval(() => {
      index = (index + 1) % LOADING_MESSAGES.length;
      setLoadingMessage(LOADING_MESSAGES[index]);
    }, 2200);
    return () => window.clearInterval(timer);
  }, [generating]);

  function resetFilled() {
    if (filledUrl) {
      URL.revokeObjectURL(filledUrl);
    }
    setFilled(null);
    setFilledUrl("");
    setFilledName("");
    setShowFilled(false);
  }

  function resetGenerated() {
    if (templateUrl) {
      URL.revokeObjectURL(templateUrl);
    }
    setTemplate(null);
    setTemplateUrl("");
    resetFilled();
  }

  async function handleFileChosen(nextFile) {
    if (!NOTES_ACCEPT.test(nextFile.name)) {
      setError("Please choose a PDF or an image (png, jpg).");
      return;
    }

    if (sourceUrl) {
      URL.revokeObjectURL(sourceUrl);
    }
    resetGenerated();
    setError("");
    setFile(nextFile);
    setSource(null);
    setSourceUrl(isPdfFile(nextFile.name) ? URL.createObjectURL(nextFile) : "");
    setBusyLabel("Uploading slides…");

    try {
      const record = await ingest(nextFile);
      setSource(record);
      if (!isPdfFile(nextFile.name) && record.file_url) {
        const blobUrl = await fetchPdfBlob(record.file_url);
        setSourceUrl(blobUrl);
      }
    } catch (err) {
      setError(err.message || "Could not upload that file.");
      setSource(null);
    } finally {
      setBusyLabel("");
    }
  }

  function handleClear() {
    if (sourceUrl) {
      URL.revokeObjectURL(sourceUrl);
    }
    resetGenerated();
    setFile(null);
    setSource(null);
    setSourceUrl("");
    setError("");
    setBusyLabel("");
  }

  async function handleGenerate() {
    if (!source) {
      setError("Upload lecture slides first.");
      return;
    }

    setError("");
    setGenerating(true);
    try {
      const result = await generateTemplate(source.id, settings);
      if (templateUrl) {
        URL.revokeObjectURL(templateUrl);
      }
      resetFilled();
      const blobUrl = await fetchPdfBlob(result.pdf_url);
      setTemplate(result);
      setTemplateUrl(blobUrl);
    } catch (err) {
      setError(err.message || "Could not generate a template.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleNotesChosen(nextFile) {
    if (!template) {
      setError("Generate a template first.");
      return;
    }
    if (!NOTES_ACCEPT.test(nextFile.name)) {
      setError("Please choose a PDF or an image of your filled notes.");
      return;
    }

    setError("");
    setUploadingNotes(true);
    setBusyLabel("OCR’ing your notes…");
    try {
      const result = await uploadNotes(template.template_id, nextFile);
      if (filledUrl) {
        URL.revokeObjectURL(filledUrl);
      }
      const blobUrl = await fetchPdfBlob(result.pdf_url);
      setFilled(result);
      setFilledUrl(blobUrl);
      setFilledName(nextFile.name);
      setShowFilled(true);
    } catch (err) {
      setError(err.message || "Could not read those notes.");
    } finally {
      setUploadingNotes(false);
      setBusyLabel("");
    }
  }

  async function handleDownload() {
    if (!template) {
      return;
    }
    const filename = file
      ? `${file.name.replace(/\.(pdf|png|jpe?g|webp)$/i, "")}-notes.pdf`
      : "lecture-template.pdf";
    try {
      await downloadTemplate(template.template_id, filename);
    } catch (err) {
      setError(err.message || "Could not download the PDF.");
    }
  }

  const previewingFilled = Boolean(showFilled && filledUrl);

  if (workspace) {
    return <WorkspaceScreen doc={workspace} onClose={() => setWorkspace(null)} />;
  }

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <p className="eyebrow">SteelHacks</p>
          <h1>Lecture Template</h1>
        </div>
        <p className="disclaimer">
          Generated templates may miss topics from the source slides. This is a
          fill-in note sheet, not a homework solver. Teal ink on a filled PDF
          is OCR and may misread handwriting. Open a PDF workspace to write or
          type on a page; your ink is saved in this browser.
        </p>
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
                      setWorkspace({
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
                      setWorkspace({
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
