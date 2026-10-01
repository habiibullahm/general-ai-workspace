"use client";

import type { ReactNode } from "react";
import { useState } from "react";

export function SettingsSection({ title, description, children }: { title: string; description: string; children?: ReactNode }) {
  return <section className="settings-section">
    <h2>{title}</h2>
    <p>{description}</p>
    {children ? <div className="settings-fields">{children}</div> : null}
  </section>;
}

export function SettingsChoice<T extends string>({ label, hint, value, options, disabled, onChange }: {
  label: string;
  hint?: string;
  value: T;
  options: { value: T; label: string }[];
  disabled?: boolean;
  onChange: (value: T) => void;
}) {
  return <fieldset className="settings-choice" disabled={disabled}>
    <legend>{label}</legend>
    {hint ? <p>{hint}</p> : null}
    <div className="settings-choice-options" role="radiogroup" aria-label={label}>
      {options.map((option) => <button key={option.value} type="button" role="radio" aria-checked={value === option.value} onClick={() => onChange(option.value)}>{option.label}</button>)}
    </div>
  </fieldset>;
}

export function SettingsTextField({ id, label, hint, value, maxLength, multiline = false, disabled, onCommit }: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  maxLength: number;
  multiline?: boolean;
  disabled?: boolean;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [source, setSource] = useState(value);
  if (value !== source) {
    setSource(value);
    setDraft(value);
  }
  const describedBy = hint ? `${id}-hint` : undefined;
  function commit() {
    if (draft.trim() === value.trim()) return;
    onCommit(draft);
  }
  return <div className="settings-field">
    <label htmlFor={id}>{label}</label>
    {hint ? <p id={`${id}-hint`}>{hint}</p> : null}
    {multiline
      ? <textarea id={id} maxLength={maxLength} disabled={disabled} aria-describedby={describedBy} value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={commit} />
      : <input id={id} maxLength={maxLength} disabled={disabled} aria-describedby={describedBy} value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={commit} />}
  </div>;
}
