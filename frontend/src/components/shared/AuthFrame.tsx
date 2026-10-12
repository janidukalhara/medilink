import { ReactNode } from "react";
import { ArrowLeft, Check } from "lucide-react";
import { Link } from "react-router-dom";
import Brand from "./Brand";
export default function AuthFrame({
  children,
  register = false,
}: {
  children: ReactNode;
  register?: boolean;
}) {
  return (
    <main className={`auth-page ${register ? "auth-register" : ""}`}>
      <aside className="auth-story">
        <Brand light />
        <div className="auth-story-copy">
          <span className="eyebrow">
            A LITTLE LESS EFFORT. A LOT MORE CARE.
          </span>
          <h1>
            Your care.
            <br />
            <span className="serif-accent">Connected.</span>
          </h1>
          <p>
            One place for your prescriptions, pharmacy quotations, and the next
            step in your care.
          </p>
          <div className="auth-benefits">
            {[
              "Upload and review your prescription",
              "Connect with nearby pharmacies",
              "Keep every update in one place",
            ].map((text) => (
              <span key={text}>
                <Check size={16} />
                {text}
              </span>
            ))}
          </div>
        </div>
        <img
          src="/images/medilink-care.webp"
          alt="A pharmacist welcoming a patient"
        />
        <span className="auth-story-footer">MediLink / Made for Sri Lanka</span>
      </aside>
      <section className="auth-form-side">
        <Link className="auth-back" to="/">
          <ArrowLeft size={16} /> Back to home
        </Link>
        <div className="auth-form-container">{children}</div>
        <p className="auth-bottom">
          A simpler journey from prescription to pharmacy.
        </p>
      </section>
    </main>
  );
}
