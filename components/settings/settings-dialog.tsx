"use client";

import { useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";
import { getPreferencesAction, updatePreferencesAction } from "@/app/actions/preferences";
import { settingsSections, type SettingsSectionId } from "@/components/settings/registry";
import type { ModelOption } from "@/lib/chat/models";
import { parsePreferencePatch } from "@/lib/preferences/validation";
import type { PreferencePatch, UserPreferences } from "@/lib/preferences/types";

type Props = {
  preview: boolean;
  models: ModelOption[];
  initialPreferences: UserPreferences;
  initialError: string | null;
  onClose: () => void;
  onSaved: (preferences: UserPreferences) => void;
};

function samePreferences(current: UserPreferences, patch: PreferencePatch) {
  return Object.entries(patch).every(([key, value]) => current[key as keyof PreferencePatch] === value);
}

export function SettingsDialog({ preview, models, initialPreferences, initialError, onClose, onSaved }: Props) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const edited = useRef(false);
  const [section, setSection] = useState<SettingsSectionId>("general");
  const [preferences, setPreferences] = useState(initialPreferences);
  const [loadError, setLoadError] = useState(initialError);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!preview);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const active = settingsSections.find((item) => item.id === section) ?? settingsSections[0];

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    edited.current = false;
    const frame = requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLElement>("[role='tab']")?.focus());
    return () => {
      cancelAnimationFrame(frame);
      previous?.focus();
    };
  }, []);

  useEffect(() => {
    if (preview) return;
    let cancelled = false;
    getPreferencesAction().then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (edited.current) return;
      setPreferences(result.preferences);
      setLoadError(result.error);
      onSaved(result.preferences);
    }, () => {
      if (cancelled) return;
      setLoadError("Settings couldn't be loaded. Refresh to try again.");
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [preview, onSaved]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function change(patch: PreferencePatch) {
    if (saving || loading) return;
    const parsed = parsePreferencePatch(patch);
    if ("error" in parsed) { setSaveError(parsed.error); setStatus(""); return; }
    if (samePreferences(preferences, parsed.data)) return;
    edited.current = true;
    const previous = preferences;
    const optimistic = { ...previous, ...parsed.data };
    setPreferences(optimistic);
    setSaveError(null);
    setStatus("Saving…");
    setSaving(true);
    if (preview) {
      const next = { ...optimistic, updatedAt: new Date().toISOString() };
      setPreferences(next);
      onSaved(next);
      setStatus("Saved");
      setSaving(false);
      return;
    }
    const result = await updatePreferencesAction(parsed.data);
    if (result.error) {
      setPreferences(previous);
      setSaveError(result.error);
      setStatus("");
      setSaving(false);
      return;
    }
    setPreferences(result.preferences);
    onSaved(result.preferences);
    setStatus("Saved");
    setSaving(false);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])');
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [section, loading, saving]);

  async function reload() {
    if (preview) return;
    setLoading(true);
    setLoadError(null);
    const result = await getPreferencesAction();
    setPreferences(result.preferences);
    setLoadError(result.error);
    if (!result.error) onSaved(result.preferences);
    setLoading(false);
  }

  const ActiveSection = active.Component;
  return <div className="settings-layer">
    <button type="button" className="settings-scrim" aria-label="Dismiss settings" onClick={onClose} />
    <div ref={dialogRef} className="settings-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-busy={loading || saving}>
      <header className="settings-header">
        <h1 id={titleId}>Settings</h1>
        <button type="button" className="icon-button" aria-label="Close settings" onClick={onClose}><X size={18} /></button>
      </header>
      <div className="settings-body">
        <div className="settings-nav" role="tablist" aria-label="Settings sections" aria-orientation="vertical">
          {settingsSections.map((item) => <button key={item.id} type="button" role="tab" id={`settings-tab-${item.id}`} aria-selected={item.id === active.id} aria-controls={`settings-panel-${item.id}`} tabIndex={item.id === active.id ? 0 : -1} onClick={() => setSection(item.id)}>{item.label}</button>)}
        </div>
        <div className="settings-content" role="tabpanel" id={`settings-panel-${active.id}`} aria-labelledby={`settings-tab-${active.id}`}>
          {loadError ? <p className="settings-error" role="alert">{loadError}{preview ? null : <button type="button" onClick={() => void reload()}>Try again</button>}</p> : null}
          {saveError ? <p className="settings-error" role="alert">{saveError}</p> : null}
          <ActiveSection preferences={preferences} models={models} disabled={loading || saving} onChange={(patch) => void change(patch)} />
          <p className="settings-status" role="status">{loading ? "Loading settings…" : status}</p>
        </div>
      </div>
    </div>
  </div>;
}
