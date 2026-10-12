import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowUpRight, Bell, LogOut, Menu, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { notificationAPI } from "../../services/api";
import { useSocket } from "../../context/SocketContext";
import Brand from "./Brand";

export default function Navbar() {
  const { user, logout } = useAuth();
  const socket = useSocket();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const publicLinks = [
    { to: "/#how-it-works", label: "How it works" },
    { to: "/#our-platform", label: "Our platform" },
    { to: "/#for-pharmacies", label: "For pharmacies" },
  ];
  const roleLinks =
    user?.role === "patient"
      ? [
          { to: "/patient", label: "Overview" },
          { to: "/patient/upload", label: "Upload prescription" },
          { to: "/patient/prescriptions", label: "My prescriptions" },
        ]
      : user?.role === "pharmacy"
        ? [
            { to: "/pharmacy", label: "Overview" },
            { to: "/pharmacy/requests", label: "Prescription requests" },
            { to: "/pharmacy/inventory", label: "Medicine inventory" },
          ]
        : [{ to: "/admin", label: "Administration" }];
  const links = user ? roleLinks : publicLinks;
  useEffect(() => {
    setOpen(false);
  }, [location.pathname, location.hash]);
  useEffect(() => {
    if (user)
      notificationAPI
        .getAll()
        .then((r) => setUnread(r.data.unreadCount))
        .catch(() => {});
  }, [user, location.pathname]);
  useEffect(() => {
    if (!socket) return;
    const onNotification = () => setUnread((v) => v + 1);
    const events = [
      "new_quotation",
      "prescription_processed",
      "quotation_accepted",
      "order_status_updated",
    ];
    events.forEach((event) => socket.on(event, onNotification));
    return () => {
      events.forEach((event) => socket.off(event, onNotification));
    };
  }, [socket]);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const root = document.getElementById("root");
    root?.setAttribute("inert", "");
    panel.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const keyboard = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "Tab") {
        const nodes = panel.current?.querySelectorAll<HTMLElement>(
          "a[href], button:not([disabled])",
        );
        if (!nodes?.length) return;
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", keyboard);
    return () => {
      document.body.style.overflow = previous;
      root?.removeAttribute("inert");
      document.removeEventListener("keydown", keyboard);
      trigger.current?.focus();
    };
  }, [open]);
  return (
    <>
      <header className="site-nav">
        <div className="nav-inner">
          <Brand />
          <nav className="desktop-links" aria-label="Main navigation">
            {links.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                aria-current={
                  location.pathname === link.to ? "page" : undefined
                }
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="nav-actions">
            {user ? (
              <Link
                to="/notifications"
                className="icon-button notification-button"
                aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
                onClick={() => setUnread(0)}
              >
                <Bell size={19} />
                {unread > 0 && <span>{unread > 9 ? "9+" : unread}</span>}
              </Link>
            ) : (
              <Link to="/login" className="nav-signin">
                Sign in <ArrowUpRight size={15} />
              </Link>
            )}
            <button
              ref={trigger}
              className="menu-trigger"
              aria-label="Menu"
              onClick={() => setOpen(true)}
              aria-expanded={open}
              aria-controls="staggered-menu"
            >
              <span>Menu</span>
              <Menu size={20} />
            </button>
          </div>
        </div>
      </header>
      {open &&
        createPortal(
          <div
            className="menu-backdrop"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setOpen(false);
            }}
          >
            <div className="menu-underlay" />
            <div
              id="staggered-menu"
              ref={panel}
              className="staggered-menu"
              role="dialog"
              aria-modal="true"
              aria-labelledby="menu-title"
            >
              <div className="menu-top">
                <span id="menu-title" className="eyebrow">
                  YOUR NEXT STEP TO BETTER CARE
                </span>
                <button
                  className="icon-button"
                  aria-label="Close menu"
                  onClick={() => setOpen(false)}
                >
                  <X />
                </button>
              </div>
              <nav aria-label="Expanded navigation">
                {[
                  ...(!user ? [{ to: "/", label: "Home" }] : []),
                  ...links,
                  ...(!user
                    ? [
                        { to: "/register", label: "Get started" },
                        { to: "/login", label: "Sign in" },
                      ]
                    : [{ to: "/notifications", label: "Notifications" }]),
                ].map((link, i) => (
                  <Link
                    key={`${link.to}-${i}`}
                    to={link.to}
                    onClick={() => setOpen(false)}
                    style={{ animationDelay: `${100 + i * 65}ms` }}
                  >
                    <span className="menu-number">0{i + 1}</span>
                    <span>{link.label}</span>
                    <ArrowUpRight />
                  </Link>
                ))}
              </nav>
              <div className="menu-bottom">
                {user ? (
                  <>
                    <div>
                      <strong>{user.name}</strong>
                      <p>{user.role} workspace</p>
                    </div>
                    <button
                      className="btn-secondary"
                      onClick={() => {
                        setOpen(false);
                        logout();
                        navigate("/login");
                      }}
                    >
                      <LogOut size={16} /> Sign out
                    </button>
                  </>
                ) : (
                  <>
                    <p>
                      Less running around.
                      <br />
                      More peace of mind.
                    </p>
                    <span className="small-tag">Made for Sri Lanka</span>
                  </>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
