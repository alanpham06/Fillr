import { Link, useNavigate, useSearchParams } from "react-router-dom";
import WorkspaceScreen from "../components/WorkspaceScreen.jsx";
import { useAppSession } from "../context/AppSession.jsx";

function docFromParams(params) {
  const kind = params.get("kind");
  const id = params.get("id");
  if (!kind || !id) {
    return null;
  }
  return {
    kind,
    id,
    title: params.get("title") || "Workspace",
    filename: params.get("filename") || "notes.pdf",
    pageCount: Number(params.get("pageCount")) || 1,
  };
}

export default function EditorPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { workspace, setWorkspace } = useAppSession();
  const doc = workspace || docFromParams(params);

  if (!doc) {
    return (
      <div className="page-empty">
        <div className="page-empty-icon" aria-hidden="true">
          📝
        </div>
        <h1>Nothing to edit yet</h1>
        <p className="muted">
          Generate a template first, then use <strong>Edit</strong> on a PDF to
          write or type on the page.
        </p>
        <Link to="/create" className="primary hero-btn">
          Go to workspace →
        </Link>
      </div>
    );
  }

  return (
    <WorkspaceScreen
      doc={doc}
      onClose={() => {
        setWorkspace(null);
        navigate("/create");
      }}
    />
  );
}
