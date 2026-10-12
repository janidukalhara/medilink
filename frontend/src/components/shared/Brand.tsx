import { Link } from "react-router-dom";
import { Activity } from "lucide-react";
export default function Brand({ light = false }: { light?: boolean }) {
  return (
    <Link
      to="/"
      className={`brand ${light ? "brand-light" : ""}`}
      aria-label="MediLink home"
    >
      <span className="brand-mark">
        <Activity size={23} strokeWidth={1.8} />
      </span>
      <span>
        Medi<span className="brand-lightweight">Link</span>
        <span className="brand-period">.</span>
      </span>
    </Link>
  );
}
