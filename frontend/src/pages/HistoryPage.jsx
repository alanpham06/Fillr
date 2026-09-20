import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAppSession } from "../context/AppSession.jsx";
import { deleteSession, listSessions } from "../lib/sessionStore.js";

function formatDate(value) {
  if (!value) {
    return "";
  }
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function densityLabel(density) {
  if (density === "less_full") {
    return "More blank space";
  }
  if (density === "more_full") {
    return "More structure";
  }
  return "";
}

export default function HistoryPage() {
  const navigate = useNavigate();
  const { restoreSession } = useAppSession();
  const [tick, setTick] = useState(0);
  const sessions = useMemo(() => listSessions(), [tick]);

  async function open(session) {
    await restoreSession(session);
    navigate("/create");
  }

  function remove(id) {
    deleteSession(id);
    setTick((value) => value + 1);
  }

  if (sessions.length === 0) {
    return (
      <div className="page-empty">
        <div className="page-empty-icon" aria-hidden="true">
          📂
        </div>
        <h1>No saved sessions yet</h1>
        <p className="muted">
          Generate a template and hit Save to keep it here. Workspace ink is
          also stored in this browser.
        </p>
        <Link to="/create" className="primary hero-btn">
          Create a template →
        </Link>
      </div>
    );
  }

  return (
    <div className="page-doc history-page">
      <div className="history-head">
        <h1>Saved sessions</h1>
        <Link to="/create" className="primary">
          New +
        </Link>
      </div>

      <ul className="history-list">
        {sessions.map((session) => (
          <li key={session.id} className="card history-card">
            <div className="history-copy">
              <h2>{session.title || "Untitled notes"}</h2>
              <p className="history-meta">
                <span>{formatDate(session.updatedAt)}</span>
                {densityLabel(session.settings?.density) ? (
                  <>
                    <span>·</span>
                    <span>{densityLabel(session.settings.density)}</span>
                  </>
                ) : null}
                {session.templateId ? (
                  <>
                    <span>·</span>
                    <span>Template ready</span>
                  </>
                ) : null}
                {session.hasFilled ? (
                  <>
                    <span>·</span>
                    <span>Filled notes</span>
                  </>
                ) : null}
              </p>
              {session.sourceName ? (
                <p className="muted history-preview">{session.sourceName}</p>
              ) : null}
            </div>
            <div className="history-actions">
              <button type="button" className="secondary" onClick={() => void open(session)}>
                Open
              </button>
              <button type="button" className="danger-btn" onClick={() => remove(session.id)}>
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
