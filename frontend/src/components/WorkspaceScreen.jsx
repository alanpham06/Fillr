import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  downloadWorkspacePdf,
  exportWorkspace,
  fetchWorkspaceInfo,
  workspacePageUrl,
} from "../api.js";
import { containRect, LETTER_ASPECT } from "../lib/geometry.js";
import { loadWorkspace, saveWorkspace } from "../lib/workspaceStore.js";
import {
  COLOR_ORDER,
  DRAW_TOOLS,
  DRAW_TOOL_LABELS,
  emptyPage,
  FONT_SIZE_ORDER,
  FONT_SIZES,
  fontSizeName,
  HIGHLIGHTER_OPACITY,
  HIGHLIGHTER_WIDTH_PX,
  INK_COLORS,
  pageHasInk,
  PEN_WIDTH_PX,
  placedTextBox,
  strokeOpacity,
  strokeTool,
} from "../lib/workspaceTypes.js";
import { useContainerSize } from "../hooks/useContainerSize.js";
import InkOverlay from "./InkOverlay.jsx";
import TextBoxLayer from "./TextBoxLayer.jsx";

let textSeq = 0;
function nextTextId() {
  textSeq += 1;
  return `text-${Date.now()}-${textSeq}`;
}

function notesFilename(name) {
  const stem = name.replace(/\.(pdf|png|jpe?g|webp)$/i, "");
  return `${stem || "notes"}-annotated.pdf`;
}

export default function WorkspaceScreen({ doc, onClose }) {
  const [pageCount, setPageCount] = useState(Math.max(1, doc.pageCount || 1));
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState({});
  const [mode, setMode] = useState("write");
  const [drawTool, setDrawTool] = useState("pen");
  const [colorName, setColorName] = useState("Black");
  const [colorOpen, setColorOpen] = useState(false);
  const [fontName, setFontName] = useState("M");
  const [textBold, setTextBold] = useState(false);
  const [textItalic, setTextItalic] = useState(false);
  const [selectedTextId, setSelectedTextId] = useState(null);
  const [saveStatus, setSaveStatus] = useState("loading");
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [imageSize, setImageSize] = useState({ width: 850, height: 1100 });
  const [ready, setReady] = useState(false);
  const stageRef = useRef(null);
  const stage = useContainerSize(stageRef);

  const pagesRef = useRef(pages);
  const saveTimer = useRef(0);
  pagesRef.current = pages;

  const current = pages[String(page)] ?? emptyPage();
  const pageUri = workspacePageUrl(doc.kind, doc.id, page);

  useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      try {
        const stored = loadWorkspace(doc.kind, doc.id);
        const info = await fetchWorkspaceInfo(doc.kind, doc.id).catch(() => null);
        if (cancelled) {
          return;
        }
        if (stored) {
          setPages(stored.pages);
        }
        if (info?.page_count) {
          setPageCount(info.page_count);
        }
        setSaveStatus("saved");
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not open that PDF.");
          setSaveStatus("error");
        }
      } finally {
        if (!cancelled) {
          setReady(true);
        }
      }
    }
    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [doc.kind, doc.id]);

  useEffect(() => {
    setImageFailed(false);
    setSelectedTextId(null);
    setColorOpen(false);
  }, [page, pageUri]);

  useEffect(() => {
    if (!colorOpen) {
      return undefined;
    }
    function close(event) {
      if (event.target.closest?.(".workspace-color")) {
        return;
      }
      setColorOpen(false);
    }
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [colorOpen]);

  const persist = useCallback(() => {
    setSaveStatus("saving");
    try {
      saveWorkspace(doc.kind, doc.id, { version: 1, pages: pagesRef.current });
      setSaveStatus("saved");
      setError("");
    } catch (err) {
      setSaveStatus("error");
      setError(err instanceof Error ? err.message : "Could not save your notes.");
      throw err;
    }
  }, [doc.id, doc.kind]);

  const scheduleSave = useCallback(() => {
    window.clearTimeout(saveTimer.current);
    setSaveStatus("saving");
    saveTimer.current = window.setTimeout(() => {
      try {
        persist();
      } catch {
        /* status already set */
      }
    }, 350);
  }, [persist]);

  useEffect(() => {
    return () => window.clearTimeout(saveTimer.current);
  }, []);

  const updatePage = useCallback(
    (pageNumber, updater) => {
      setPages((prev) => {
        const key = String(pageNumber);
        const next = updater(prev[key] ?? emptyPage());
        return { ...prev, [key]: next };
      });
      scheduleSave();
    },
    [scheduleSave],
  );

  const handleStroke = useCallback(
    (stroke) => {
      updatePage(page, (currentPage) => ({
        ...currentPage,
        strokes: [...currentPage.strokes, stroke],
      }));
    },
    [page, updatePage],
  );

  const handleErase = useCallback(
    (ids) => {
      if (ids.length === 0) {
        return;
      }
      const remove = new Set(ids);
      updatePage(page, (currentPage) => ({
        ...currentPage,
        strokes: currentPage.strokes.filter((stroke) => !remove.has(stroke.id)),
      }));
    },
    [page, updatePage],
  );

  const handleUndo = useCallback(() => {
    updatePage(page, (currentPage) => {
      if (currentPage.strokes.length > 0) {
        return { ...currentPage, strokes: currentPage.strokes.slice(0, -1) };
      }
      if (currentPage.texts.length > 0) {
        return { ...currentPage, texts: currentPage.texts.slice(0, -1) };
      }
      return currentPage;
    });
    setSelectedTextId(null);
  }, [page, updatePage]);

  const handleClearPage = useCallback(() => {
    if (!pageHasInk(current)) {
      return;
    }
    if (!window.confirm("Clear this page? Ink and typed notes on this page will be removed.")) {
      return;
    }
    updatePage(page, () => emptyPage());
    setSelectedTextId(null);
  }, [current, page, updatePage]);

  const handlePlaceText = useCallback(
    (x, y) => {
      const id = nextTextId();
      updatePage(page, (currentPage) => ({
        ...currentPage,
        texts: [
          ...currentPage.texts,
          {
            id,
            ...placedTextBox(x, y),
            text: "",
            fontSize: FONT_SIZES[fontName],
            color: INK_COLORS[colorName],
            bold: textBold,
            italic: textItalic,
          },
        ],
      }));
      setSelectedTextId(id);
    },
    [colorName, fontName, page, textBold, textItalic, updatePage],
  );

  const handleChangeText = useCallback(
    (id, patch) => {
      updatePage(page, (currentPage) => ({
        ...currentPage,
        texts: currentPage.texts.map((box) => (box.id === id ? { ...box, ...patch } : box)),
      }));
    },
    [page, updatePage],
  );

  useEffect(() => {
    const box = current.texts.find((item) => item.id === selectedTextId);
    if (!box) {
      return;
    }
    setFontName(fontSizeName(box.fontSize));
    setTextBold(Boolean(box.bold));
    setTextItalic(Boolean(box.italic));
    const match = COLOR_ORDER.find((name) => INK_COLORS[name].toLowerCase() === box.color.toLowerCase());
    if (match) {
      setColorName(match);
    }
  }, [selectedTextId]);

  const applyColor = useCallback(
    (name) => {
      setColorName(name);
      setColorOpen(false);
      if (mode === "type" && selectedTextId) {
        handleChangeText(selectedTextId, { color: INK_COLORS[name] });
      }
    },
    [handleChangeText, mode, selectedTextId],
  );

  const applyDrawTool = useCallback(
    (next) => {
      setDrawTool(next);
      setColorOpen(false);
      if (next === "highlighter" && colorName === "Black") {
        setColorName("Yellow");
      }
      if (next === "pen" && colorName === "Yellow") {
        setColorName("Black");
      }
    },
    [colorName],
  );

  const applyFontSize = useCallback(
    (name) => {
      setFontName(name);
      if (selectedTextId) {
        handleChangeText(selectedTextId, { fontSize: FONT_SIZES[name] });
      }
    },
    [handleChangeText, selectedTextId],
  );

  const applyBold = useCallback(() => {
    setTextBold((prev) => {
      const next = !prev;
      if (selectedTextId) {
        handleChangeText(selectedTextId, { bold: next });
      }
      return next;
    });
  }, [handleChangeText, selectedTextId]);

  const applyItalic = useCallback(() => {
    setTextItalic((prev) => {
      const next = !prev;
      if (selectedTextId) {
        handleChangeText(selectedTextId, { italic: next });
      }
      return next;
    });
  }, [handleChangeText, selectedTextId]);

  const handleRemoveText = useCallback(
    (id) => {
      updatePage(page, (currentPage) => ({
        ...currentPage,
        texts: currentPage.texts.filter((box) => box.id !== id),
      }));
      setSelectedTextId(null);
    },
    [page, updatePage],
  );

  const handleBack = useCallback(() => {
    window.clearTimeout(saveTimer.current);
    saveTimer.current = 0;
    try {
      persist();
      onClose();
    } catch {
      if (window.confirm("Could not save your notes. Leave anyway? Ink and typed notes may be lost.")) {
        onClose();
      }
    }
  }, [onClose, persist]);

  const handleSave = useCallback(() => {
    window.clearTimeout(saveTimer.current);
    saveTimer.current = 0;
    try {
      persist();
    } catch {
      /* status already set */
    }
  }, [persist]);

  const handleExport = useCallback(async () => {
    window.clearTimeout(saveTimer.current);
    saveTimer.current = 0;
    try {
      persist();
    } catch {
      return;
    }
    setExporting(true);
    setError("");
    try {
      const payload = {
        kind: doc.kind,
        id: doc.id,
        pages: Object.entries(pagesRef.current)
          .map(([key, value]) => ({
            page: Number(key),
            strokes: value.strokes.map((stroke) => ({
              points: stroke.points,
              color: stroke.color,
              width: stroke.width,
              tool: strokeTool(stroke),
              opacity: strokeOpacity(stroke),
            })),
            texts: value.texts
              .filter((box) => box.text.trim().length > 0)
              .map((box) => ({
                x: box.x,
                y: box.y,
                width: box.width,
                height: box.height,
                text: box.text,
                font_size: box.fontSize,
                color: box.color,
                bold: Boolean(box.bold),
                italic: Boolean(box.italic),
              })),
          }))
          .filter((entry) => entry.strokes.length > 0 || entry.texts.length > 0),
      };
      const result = await exportWorkspace(payload);
      await downloadWorkspacePdf(result.pdf_url, notesFilename(doc.filename));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not download the annotated PDF.");
    } finally {
      setExporting(false);
    }
  }, [doc.filename, doc.id, doc.kind, persist]);

  const pageRect = useMemo(() => {
    const aspect = imageSize.width / imageSize.height || LETTER_ASPECT;
    const naturalWidth = 1000;
    const naturalHeight = naturalWidth / aspect;
    return containRect(stage.width, stage.height, naturalWidth, naturalHeight);
  }, [imageSize.height, imageSize.width, stage.height, stage.width]);

  const widthNorm =
    (drawTool === "highlighter" ? HIGHLIGHTER_WIDTH_PX : PEN_WIDTH_PX) / Math.max(pageRect.width, 1);
  const strokeAlpha = drawTool === "highlighter" ? HIGHLIGHTER_OPACITY : 1;
  const canUndo = current.strokes.length > 0 || current.texts.length > 0;
  const saveLabel =
    saveStatus === "saving" ? "Saving…" : saveStatus === "error" ? "Save failed" : "Saved";

  return (
    <div className="workspace-app">
      <header className="workspace-topbar">
        <button type="button" className="ghost workspace-back" onClick={handleBack}>
          ← Notes
        </button>
        <div className="workspace-title-block">
          <p className="eyebrow">Workspace</p>
          <h1>{doc.title}</h1>
        </div>
        <p className={`workspace-save${saveStatus === "error" ? " is-error" : ""}`}>{saveLabel}</p>
      </header>

      <div className="workspace-toolbar" role="toolbar" aria-label="Workspace tools">
        <div className="segmented" role="radiogroup" aria-label="Workspace mode">
          {[
            ["write", "Write"],
            ["type", "Type"],
          ].map(([value, label]) => (
            <label key={value} className={mode === value ? "on" : ""}>
              <input
                type="radio"
                name="workspaceMode"
                value={value}
                checked={mode === value}
                onChange={() => {
                  setMode(value);
                  setColorOpen(false);
                  if (value === "write") {
                    setSelectedTextId(null);
                  }
                }}
              />
              {label}
            </label>
          ))}
        </div>

        {mode === "write" ? (
          <div className="segmented" role="radiogroup" aria-label="Drawing tool">
            {DRAW_TOOLS.map((value) => (
              <label key={value} className={drawTool === value ? "on" : ""}>
                <input
                  type="radio"
                  name="drawTool"
                  value={value}
                  checked={drawTool === value}
                  onChange={() => applyDrawTool(value)}
                />
                {DRAW_TOOL_LABELS[value]}
              </label>
            ))}
          </div>
        ) : (
          <div className="workspace-tool-group">
            {FONT_SIZE_ORDER.map((name) => (
              <button
                key={name}
                type="button"
                className={`chip${name === fontName ? " is-selected" : ""}`}
                aria-pressed={name === fontName}
                onClick={() => applyFontSize(name)}
              >
                {name}
              </button>
            ))}
            <button
              type="button"
              className={`chip chip-format${textBold ? " is-selected" : ""}`}
              aria-pressed={textBold}
              onClick={applyBold}
            >
              <strong>B</strong>
            </button>
            <button
              type="button"
              className={`chip chip-format${textItalic ? " is-selected" : ""}`}
              aria-pressed={textItalic}
              onClick={applyItalic}
            >
              <em>I</em>
            </button>
          </div>
        )}

        {drawTool !== "eraser" || mode === "type" ? (
          <div className="workspace-color">
            <button
              type="button"
              className="workspace-color-btn"
              aria-expanded={colorOpen}
              aria-label="Color"
              onClick={(event) => {
                event.stopPropagation();
                setColorOpen((open) => !open);
              }}
            >
              <span className="workspace-color-dot" style={{ backgroundColor: INK_COLORS[colorName] }} />
              Color
            </button>
            {colorOpen ? (
              <div
                className="workspace-color-menu"
                role="menu"
                onPointerDown={(event) => event.stopPropagation()}
              >
                {COLOR_ORDER.map((name) => (
                  <button
                    key={name}
                    type="button"
                    className={`workspace-swatch${name === colorName ? " is-selected" : ""}`}
                    style={{ backgroundColor: INK_COLORS[name] }}
                    aria-label={name}
                    aria-pressed={name === colorName}
                    onClick={() => applyColor(name)}
                  />
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="workspace-tool-group">
          <button type="button" className="chip" disabled={!canUndo} onClick={handleUndo}>
            Undo
          </button>
          <button type="button" className="chip" disabled={!canUndo} onClick={handleClearPage}>
            Clear page
          </button>
          <button type="button" className="chip" onClick={handleSave}>
            Save
          </button>
          <button type="button" className="primary workspace-download" disabled={exporting} onClick={() => void handleExport()}>
            {exporting ? "Preparing…" : "Download"}
          </button>
        </div>
      </div>

      {error ? <div className="banner error workspace-banner">{error}</div> : null}

      <div className="workspace-stage" ref={stageRef}>
        {!ready ? (
          <div className="empty-state">
            <p>Opening workspace…</p>
          </div>
        ) : imageFailed ? (
          <div className="empty-state">
            <h3>Could not load this page</h3>
            <p>Check the API server, then go back and open the workspace again.</p>
          </div>
        ) : (
          <>
            {pageRect.width > 0 ? (
              <img
                className="workspace-page"
                src={pageUri}
                alt={`Page ${page}`}
                style={{
                  left: pageRect.x,
                  top: pageRect.y,
                  width: pageRect.width,
                  height: pageRect.height,
                }}
                onLoad={(event) => {
                  const { naturalWidth, naturalHeight } = event.currentTarget;
                  if (naturalWidth > 0 && naturalHeight > 0) {
                    setImageSize({ width: naturalWidth, height: naturalHeight });
                  }
                }}
                onError={() => setImageFailed(true)}
              />
            ) : null}
            {pageRect.width > 0 ? (
              <div
                className="workspace-overlay"
                style={{
                  left: pageRect.x,
                  top: pageRect.y,
                  width: pageRect.width,
                  height: pageRect.height,
                }}
              >
                <InkOverlay
                  strokes={current.strokes}
                  enabled={mode === "write"}
                  color={INK_COLORS[colorName]}
                  widthNorm={widthNorm}
                  width={pageRect.width}
                  height={pageRect.height}
                  tool={drawTool}
                  opacity={strokeAlpha}
                  onStrokeComplete={handleStroke}
                  onEraseStrokes={handleErase}
                />
                <TextBoxLayer
                  boxes={current.texts}
                  selectedId={selectedTextId}
                  enabled={mode === "type"}
                  pageWidth={pageRect.width}
                  pageHeight={pageRect.height}
                  onSelect={setSelectedTextId}
                  onChange={handleChangeText}
                  onRemove={handleRemoveText}
                  onPlace={handlePlaceText}
                />
              </div>
            ) : null}
          </>
        )}
      </div>

      <footer className="workspace-pager">
        <button type="button" className="ghost" disabled={page <= 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>
          ‹ Prev
        </button>
        <span>
          Page {page} of {pageCount}
        </span>
        <button
          type="button"
          className="ghost"
          disabled={page >= pageCount}
          onClick={() => setPage((prev) => Math.min(pageCount, prev + 1))}
        >
          Next ›
        </button>
      </footer>
    </div>
  );
}
