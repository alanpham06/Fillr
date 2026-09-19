import { useEffect, useRef, useState } from "react";
import { downloadTemplate, fetchPdfBlob, generateTemplate, ingest } from "./api.js";
import PdfPane from "./components/PdfPane.jsx";
import SettingsSidebar from "./components/SettingsSidebar.jsx";

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

export default function App() {
  const fileInputRef = useRef(null);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [file, setFile] = useState(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [source, setSource] = useState(null);
  const [template, setTemplate] = useState(null);
  const [templateUrl, setTemplateUrl] = useState("");
  const [generating, setGenerating] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState(LOADING_MESSAGES[0]);
  const [error, setError] = useState("");
  const [busyLabel, setBusyLabel] = useState("");

  useEffect(() => {
    return () => {
      if (sourceUrl) {
        URL.revokeObjectURL(sourceUrl);
      }
      if (templateUrl) {
        URL.revokeObjectURL(templateUrl);
      }
    };
  }, [sourceUrl, templateUrl]);

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

  function resetGenerated() {
    if (templateUrl) {
      URL.revokeObjectURL(templateUrl);
    }
    setTemplate(null);
    setTemplateUrl("");
  }

  async function handleFileChosen(nextFile) {
    if (!nextFile.name.toLowerCase().endsWith(".pdf")) {
      setError("Please choose a PDF file.");
      return;
    }

    if (sourceUrl) {
      URL.revokeObjectURL(sourceUrl);
    }
    resetGenerated();
    setError("");
    setFile(nextFile);
    setSource(null);
    setSourceUrl(URL.createObjectURL(nextFile));
    setBusyLabel("Uploading slides…");

    try {
      const record = await ingest(nextFile);
      setSource(record);
    } catch (err) {
      setError(err.message || "Could not upload that PDF.");
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
      const blobUrl = await fetchPdfBlob(result.pdf_url);
      setTemplate(result);
      setTemplateUrl(blobUrl);
    } catch (err) {
      setError(err.message || "Could not generate a template.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleDownload() {
    if (!template) {
      return;
    }
    const filename = file
      ? `${file.name.replace(/\.pdf$/i, "")}-notes.pdf`
      : "lecture-template.pdf";
    try {
      await downloadTemplate(template.template_id, filename);
    } catch (err) {
      setError(err.message || "Could not download the PDF.");
    }
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
          fill-in note sheet, not a homework solver.
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
              subtitle={file ? file.name : "Waiting for a PDF"}
              file={sourceUrl || null}
              emptyTitle="No slides yet"
              emptyBody="Upload a lecture PDF to preview it here, page by page."
            />
            <PdfPane
              title="Generated template"
              subtitle={
                template
                  ? "Fill-in lecture notes"
                  : "Will appear after you generate"
              }
              file={templateUrl || null}
              emptyTitle="No template yet"
              emptyBody="Choose your settings, then generate a fill-in note sheet."
            />
          </div>
        </main>
      </div>
    </div>
  );
}
