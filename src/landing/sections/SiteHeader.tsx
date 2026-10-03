import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const LINKS = [
  { href: "#home", label: "Home", id: "home" },
  { href: "#about", label: "Why 3D", id: "about" },
  { href: "#platform", label: "How it works", id: "platform" },
  { href: "#assets", label: "What it records", id: "assets" },
];

export function SiteHeader({ active }: { active: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="site-header">
      <nav className={`navigation${open ? " menu-open" : ""}`} aria-label="Main navigation">
        <a className="wordmark" href="#home" aria-label="ULPIN 3D home">
          ulpin<span>3d</span>
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M8 1 15 8 8 15 1 8Z" />
          </svg>
        </a>
        <button
          className="menu-toggle"
          aria-expanded={open}
          aria-controls="nav-links"
          onClick={() => setOpen(!open)}
        >
          Menu <span aria-hidden="true">+</span>
        </button>
        <div className="nav-links" id="nav-links">
          {LINKS.map((link) => (
            <a
              key={link.id}
              href={link.href}
              className={active === link.id ? "active" : undefined}
              aria-current={active === link.id ? "location" : undefined}
              onClick={() => setOpen(false)}
            >
              {link.label}
            </a>
          ))}
        </div>
        <div className="nav-actions">
          <Link className="nav-cta" to="/app/registry">
            Registry
          </Link>
          <Link className="nav-cta" to="/app">
            <svg className="arrow" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 12h15m-6-6 6 6-6 6" />
            </svg>
            Workspace
          </Link>
        </div>
      </nav>
    </header>
  );
}
