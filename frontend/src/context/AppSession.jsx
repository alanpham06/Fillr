import { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  downloadTemplate,
  fetchPdfBlob,
  filledFileUrl,
  generateTemplate,
  ingest,
  sourceFileUrl,
  templateFileUrl,
  uploadNotes,
} from "../api.js";
import { upsertSession } from "../lib/sessionStore.js";

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

const AppSessionContext = createContext(null);

function isPdfFile(name) {
  return name.toLowerCase().endsWith(".pdf");
}

function displayFile(name) {
  return name ? { name } : null;
}

export function AppSessionProvider({ children }) {
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
  const [sessionTitle, setSessionTitle] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);
  const savedTimer = useRef(0);

  useEffect(() => {
    return () => {
      if (sourceUrl) {
        URL.revokeObjectURL(sourceUrl);
      }
    };
  }, [sourceUrl]);

  useEffect(() => {
    return () => {
      if (templateUrl) {
        URL.revokeObjectURL(templateUrl);
      }
    };
  }, [templateUrl]);

  useEffect(() => {
    return () => {
      if (filledUrl) {
        URL.revokeObjectURL(filledUrl);
      }
    };
  }, [filledUrl]);

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

  useEffect(() => {
    return () => window.clearTimeout(savedTimer.current);
  }, []);

  function currentSessionId() {
    return source?.id || template?.template_id || "";
  }

  function sessionPayload(extra = {}) {
    const id = extra.id || currentSessionId();
    if (!id) {
      return null;
    }
    return {
      id,
      title: extra.title || sessionTitle || file?.name || template?.title || "Untitled notes",
      sourceId: source?.id || extra.sourceId || "",
      sourceName: file?.name || extra.sourceName || "",
      sourcePageCount: source?.page_count || extra.sourcePageCount || 0,
      templateId: template?.template_id || extra.templateId || "",
      templatePageCount: template?.page_count || extra.templatePageCount || 0,
      filledPageCount: filled?.page_count || extra.filledPageCount || 0,
      hasFilled: Boolean(filledUrl) || Boolean(extra.hasFilled),
      filledName: filledName || extra.filledName || "",
      settings,
      ...extra,
    };
  }

  function rememberSession(extra = {}) {
    const payload = sessionPayload(extra);
    if (!payload) {
      return null;
    }
    return upsertSession(payload);
  }

  function flashSaved() {
    setSavedFlash(true);
    window.clearTimeout(savedTimer.current);
    savedTimer.current = window.setTimeout(() => setSavedFlash(false), 1800);
  }

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
    setSessionTitle(nextFile.name.replace(/\.(pdf|png|jpe?g|webp)$/i, ""));
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
      rememberSession({
        id: record.id,
        title: nextFile.name,
        sourceId: record.id,
        sourceName: nextFile.name,
        sourcePageCount: record.page_count || 0,
      });
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
    setSessionTitle("");
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
      rememberSession({
        id: source.id,
        title: sessionTitle || file?.name || "Untitled notes",
        sourceId: source.id,
        sourceName: file?.name || "",
        sourcePageCount: source.page_count || 0,
        templateId: result.template_id,
        templatePageCount: result.page_count || 0,
      });
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
      rememberSession({
        id: source?.id || template.template_id,
        hasFilled: true,
        filledName: nextFile.name,
        filledPageCount: result.page_count || 0,
      });
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

  function handleSave() {
    const saved = rememberSession();
    if (!saved) {
      setError("Upload slides or generate a template before saving.");
      return;
    }
    flashSaved();
  }

  async function restoreSession(session) {
    if (!session) {
      return;
    }
    setError("");
    setBusyLabel("Opening session…");
    setSettings(session.settings || DEFAULT_SETTINGS);
    setFile(displayFile(session.sourceName || session.title));
    setSessionTitle(session.title || session.sourceName || "");
    setWorkspace(null);
    setShowFilled(false);

    if (sourceUrl) {
      URL.revokeObjectURL(sourceUrl);
    }
    if (templateUrl) {
      URL.revokeObjectURL(templateUrl);
    }
    if (filledUrl) {
      URL.revokeObjectURL(filledUrl);
    }
    setSourceUrl("");
    setTemplateUrl("");
    setFilledUrl("");
    setFilled(null);
    setFilledName(session.filledName || "");

    try {
      if (session.sourceId) {
        setSource({
          id: session.sourceId,
          page_count: session.sourcePageCount || 0,
        });
        const blobUrl = await fetchPdfBlob(sourceFileUrl(session.sourceId));
        setSourceUrl(blobUrl);
      } else {
        setSource(null);
      }

      if (session.templateId) {
        setTemplate({
          template_id: session.templateId,
          page_count: session.templatePageCount || 1,
        });
        const blobUrl = await fetchPdfBlob(templateFileUrl(session.templateId));
        setTemplateUrl(blobUrl);
      } else {
        setTemplate(null);
      }

      if (session.hasFilled && session.templateId) {
        try {
          const blobUrl = await fetchPdfBlob(filledFileUrl(session.templateId));
          setFilled({
            page_count: session.filledPageCount || session.templatePageCount || 1,
          });
          setFilledUrl(blobUrl);
          setShowFilled(true);
        } catch {
          setFilled(null);
        }
      }
    } catch (err) {
      setError(err.message || "Could not reopen that session. The API may have restarted.");
    } finally {
      setBusyLabel("");
    }
  }

  const value = {
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
    setError,
    busyLabel,
    workspace,
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
    restoreSession,
  };

  return <AppSessionContext.Provider value={value}>{children}</AppSessionContext.Provider>;
}

export function useAppSession() {
  const value = useContext(AppSessionContext);
  if (!value) {
    throw new Error("useAppSession must be used inside AppSessionProvider");
  }
  return value;
}

export { DEFAULT_SETTINGS, LOADING_MESSAGES };
