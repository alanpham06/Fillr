import { NavLink, useLocation } from "react-router-dom";
import FillrLogo from "./FillrLogo.jsx";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/create", label: "Create" },
  { href: "/history", label: "History" },
];

function linkIsActive(href, pathname) {
  if (href === "/") {
    return pathname === "/";
  }
  if (href === "/create") {
    return pathname.startsWith("/create") || pathname.startsWith("/editor");
  }
  return pathname.startsWith(href);
}

export default function Navbar() {
  const { pathname } = useLocation();

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <NavLink to="/" end className="navbar-brand" aria-label="Fillr home">
          <FillrLogo />
        </NavLink>
        <div className="navbar-links">
          {LINKS.map((link) => (
            <NavLink
              key={link.href}
              to={link.href}
              end={link.href === "/"}
              className={() =>
                `navbar-link${linkIsActive(link.href, pathname) ? " is-active" : ""}`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
}
