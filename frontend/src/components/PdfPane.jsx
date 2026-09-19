import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { useContainerSize } from "../hooks/useContainerSize.js";
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
}) {
  const [numPages, setNumPages] = useState(null);
  const [page, setPage] = useState(1);
  const [loadError, setLoadError] = useState("");
  const probeRef = useRef(null);
  const { width } = useContainerSize(probeRef);

  useEffect(() => {
    setPage(1);
    setNumPages(null);
    setLoadError("");
  }, [file]);

  return (
    <section className="pane">
      <header className="pane-head">
        <div className="pane-head-copy">
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {file ? (
          <div className="pager">
            <button
              type="button"
              className="ghost"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
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
              onClick={() =>
                setPage((current) => Math.min(numPages, current + 1))
              }
            >
              Next
            </button>
          </div>
        ) : null}
      </header>

      <div className="pane-body">
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
              <Page
                pageNumber={page}
                width={width}
                renderAnnotationLayer
                renderTextLayer
              />
            </Document>
          </div>
        ) : null}
      </div>
    </section>
  );
}
