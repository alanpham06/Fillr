export function FillrMark({ className = "fillr-mark" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="8" fill="currentColor" />
      <path
        d="M11 22.5V9.5h11M11 16h8"
        stroke="#fff"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function FillrLogo({ showWordmark = true }) {
  return (
    <span className="fillr-brand">
      <FillrMark />
      {showWordmark ? <span className="navbar-name">Fillr</span> : null}
    </span>
  );
}
