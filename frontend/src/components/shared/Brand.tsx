import { Link } from "react-router-dom";
export default function Brand({ light = false }: { light?: boolean }) {
  return (
    <Link
      to="/"
      className={`brand ${light ? "brand-light" : ""}`}
      aria-label="MediLink home"
    >
      <span className="brand-mark">
        <img src="/brand/medilink-mark.webp" width="48" height="48" alt="" />
      </span>
      <span>
        Medi<span className="brand-lightweight">Link</span>
        <span className="brand-period">.</span>
      </span>
    </Link>
  );
}
