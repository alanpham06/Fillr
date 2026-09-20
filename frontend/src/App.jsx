import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import { AppSessionProvider } from "./context/AppSession.jsx";
import CreatePage from "./pages/CreatePage.jsx";
import EditorPage from "./pages/EditorPage.jsx";
import HistoryPage from "./pages/HistoryPage.jsx";
import HomePage from "./pages/HomePage.jsx";

function AppShell() {
  const { pathname } = useLocation();
  const isFixed = pathname.startsWith("/create") || pathname.startsWith("/editor");

  return (
    <div className={`app-shell${isFixed ? " is-fixed" : ""}`}>
      <Navbar />
      <div className="app-main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/create" element={<CreatePage />} />
          <Route path="/editor" element={<EditorPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AppSessionProvider>
      <AppShell />
    </AppSessionProvider>
  );
}
