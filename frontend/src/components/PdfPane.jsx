import { useCallback, useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { useContainerSize } from "../hooks/useContainerSize.js";
import { observeVisiblePage, scrollPageIntoView } from "../lib/scrollPage.js";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Vite does not serve node_modules/*.mjs as a worker module.
// The file is copied to public/ on npm install (see package.json postinstall).
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

export default function PdfPane({
  title,
  subtitle,
  file,
  emptyTitle,
  emptyBody,
  actions,
  onOpenWorkspace,
}) {
  const [numPages, setNumPages] = useState(null);
  const [page, setPage] = useState(1);
  const [loadError, setLoadError] = useState("");
  const probeRef = useRef(null);
  const scrollRef = useRef(null);
  const pageRefs = useRef(new Map());
  const skipObserve = useRef(false);
  const { width } = useContainerSize(probeRef);

  const setPageNode = useCallback((pageNumber, node) => {
    if (node) {
      pageRefs.current.set(pageNumber, node);
    } else {
      pageRefs.current.delete(pageNumber);
    }
  }, []);

  const goToPage = useCallback((next, behavior = "smooth") => {
    const target = Math.max(1, numPages ? Math.min(numPages, next) : next);
    skipObserve.current = true;
    setPage(target);
    requestAnimationFrame(() => {
      scrollPageIntoView(pageRefs.current.get(target), behavior);
    });
  }, [numPages]);

  useEffect(() => {
    setPage(1);
    setNumPages(null);
    setLoadError("");
    pageRefs.current.clear();
  }, [file]);

  useEffect(() => {
    if (!file || !numPages) {
      return undefined;
    }
    skipObserve.current = true;
    const frame = requestAnimationFrame(() => {
      scrollPageIntoView(pageRefs.current.get(1), "auto");
    });
    return () => cancelAnimationFrame(frame);
  }, [file, numPages]);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root || !numPages) {
      return undefined;
    }
    const nodes = [];
    for (let index = 1; index <= numPages; index += 1) {
      const node = pageRefs.current.get(index);
      if (node) {
        nodes.push(node);
      }
    }
    return observeVisiblePage(root, nodes, (next) => {
      if (skipObserve.current) {
        skipObserve.current = false;
        return;
      }
      setPage((current) => (current === next ? current : next));
    });
  }, [file, numPages, width]);

  return (
    <section className="pane">
      <header className="pane-head">
        <div className="pane-head-copy">
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {onOpenWorkspace && file ? (
          <button type="button" className="primary pane-workspace-btn" onClick={onOpenWorkspace}>
            Edit
          </button>
        ) : null}
        {actions}
        {file ? (
          <div className="pager">
            <button
              type="button"
              className="ghost"
              disabled={page <= 1}
              onClick={() => goToPage(page - 1)}
            >
              Prev
            </button>
            <span>
              {page} / {numPages ?? "—"}
            </span>
            <button
              type="button"
              className="ghost"
              disabled={!numPages || page >= numPages}
              onClick={() => goToPage(page + 1)}
            >
              Next
            </button>
          </div>
        ) : null}
      </header>

      <div className="pane-body" ref={scrollRef}>
        <div className="pdf-width-probe" ref={probeRef} />
        {!file ? (
          <div className="empty-state">
            <div className="empty-rule" />
            <h3>{emptyTitle}</h3>
            <p>{emptyBody}</p>
          </div>
        ) : loadError ? (
          <div className="empty-state">
            <h3>Could not render this PDF</h3>
            <p>{loadError}</p>
          </div>
        ) : width > 0 ? (
          <div className="pdf-stage">
            <Document
              file={file}
              loading={<p className="pane-status">Loading PDF…</p>}
              onLoadSuccess={({ numPages: next }) => setNumPages(next)}
              onLoadError={(error) => setLoadError(error.message)}
            >
              {numPages
                ? Array.from({ length: numPages }, (_, index) => {
                    const pageNumber = index + 1;
                    return (
                      <div
                        key={pageNumber}
                        className="pdf-page"
                        data-page={pageNumber}
                        ref={(node) => setPageNode(pageNumber, node)}
                      >
                        <Page
                          pageNumber={pageNumber}
                          width={width}
                          renderAnnotationLayer
                          renderTextLayer
                        />
                      </div>
                    );
                  })
                : null}
            </Document>
          </div>
        ) : null}
      </div>
    </section>
  );
}
