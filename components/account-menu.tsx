"use client";

import { useEffect, useId, useRef, useState } from "react";
import { LogOut, Settings } from "lucide-react";
import { signOutAction } from "@/app/actions/auth";

type Props = {
  email: string;
  name: string;
  // Accepted so the sidebar keeps passing SIGN_OUT_LABEL. The menu button uses the shorter visible label.
  signOutLabel: string;
  onOpenSettings: () => void;
  compact?: boolean;
};

// Long enough to cross the gap between the account row and the panel, short enough that leaving feels immediate.
const CLOSE_DELAY_MS = 100;

export function AccountMenu({ email, name, onOpenSettings, compact = false }: Props) {
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pinned, setPinned] = useState(false);
  const [hovering, setHovering] = useState(false);
  // A click or Escape that closes the menu should stay closed while the pointer is still on the trigger.
  const [suppressHover, setSuppressHover] = useState(false);
  const open = pinned || (hovering && !suppressHover);
  const initial = (name || email).slice(0, 1).toUpperCase();

  function clearCloseTimer() {
    if (closeTimer.current == null) return;
    clearTimeout(closeTimer.current);
    closeTimer.current = null;
  }

  function pointerEnter() {
    clearCloseTimer();
    setHovering(true);
  }

  function pointerLeave() {
    clearCloseTimer();
    closeTimer.current = setTimeout(() => {
      setHovering(false);
      setSuppressHover(false);
    }, CLOSE_DELAY_MS);
  }

  function toggle() {
    if (pinned) {
      setPinned(false);
      setSuppressHover(true);
      return;
    }
    setSuppressHover(false);
    setPinned(true);
  }

  function dismiss(holdHover: boolean) {
    setPinned(false);
    setHovering(false);
    setSuppressHover(holdHover);
  }

  function openSettings() {
    dismiss(true);
    onOpenSettings();
  }

  useEffect(() => () => clearCloseTimer(), []);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) dismiss(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      dismiss(true);
      triggerRef.current?.focus();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return <div className={`account-menu${compact ? " is-compact" : ""}`} ref={rootRef} onPointerEnter={pointerEnter} onPointerLeave={pointerLeave}>
    <button ref={triggerRef} type="button" className="account-profile" aria-label={compact ? "Account" : undefined} title={compact ? "Account" : undefined} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined} onClick={toggle}>
      <span className="avatar" aria-hidden="true">{initial || "?"}</span>
      <span className="account-copy">
        <span className="account-name">{name}</span>
        <span className="account-email" title={email}>{email}</span>
      </span>
    </button>
    {open && <div id={menuId} className="account-menu-panel" role="menu" aria-label="Account">
      <p className="account-menu-kicker">Signed in as</p>
      <p className="account-menu-identity">{email}</p>
      <button type="button" className="account-menu-action" role="menuitem" onClick={openSettings}><Settings size={15} aria-hidden="true" />Settings</button>
      <form action={signOutAction}><button className="account-menu-signout" type="submit" role="menuitem"><LogOut size={15} aria-hidden="true" />Sign out</button></form>
    </div>}
  </div>;
}
