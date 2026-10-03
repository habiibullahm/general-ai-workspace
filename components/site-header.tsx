"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { chatPath } from "@/lib/routes";

export function SiteHeader({ currentPage }: { currentPage?: "docs" | "privacy" }) {
  const [open, setOpen] = useState(false);
  const navigationId = useId();
  const headerRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function dismiss(event: PointerEvent) {
      if (!headerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return <header ref={headerRef} className="landing-header">
    <nav className="landing-nav site-nav" aria-label="Primary">
      <Brand href="/" label="Nibie" />
      <button ref={toggleRef} className="site-menu-toggle" type="button" aria-label={open ? "Close navigation menu" : "Open navigation menu"}
        aria-expanded={open} aria-controls={navigationId} onClick={() => setOpen((value) => !value)}>
        {open ? <X size={21} aria-hidden="true" /> : <Menu size={21} aria-hidden="true" />}
      </button>
      <div id={navigationId} className={`landing-nav-links site-nav-links${open ? " is-open" : ""}`} onClick={() => setOpen(false)}>
        <Link href="/#product">Product</Link>
        <Link href="/#personalization">Personalization</Link>
        <Link href="/docs" aria-current={currentPage === "docs" ? "page" : undefined}>Docs</Link>
        <Link href="/privacy" aria-current={currentPage === "privacy" ? "page" : undefined}>Privacy</Link>
        <Link className="landing-button site-mobile-action" href={chatPath}>Open Nibie</Link>
      </div>
      <Link className="landing-button" href={chatPath}>Open Nibie</Link>
    </nav>
  </header>;
}
