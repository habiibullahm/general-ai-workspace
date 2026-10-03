"use client";

import { useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";
import { draftRoomAction } from "@/app/actions/rooms";
import { roomBriefFieldLimit, roomBriefFields, roomDescriptionLimit, roomNameLimit, type RoomBriefFields, type RoomDraft, type RoomOverview } from "@/lib/rooms/types";

type Props = {
  preview: boolean;
  onClose: () => void;
  onCreate: (draft: RoomDraft, brief: RoomBriefFields) => Promise<{ error?: string }>;
};

export function RoomCreateDialog({ preview, onClose, onCreate }: Props) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [overview, setOverview] = useState<RoomOverview | null>(null);
  const [working, setWorking] = useState<"draft" | "save" | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    dialog?.showModal();
    dialog?.querySelector("input")?.focus();
    return () => { dialog?.close(); previous?.focus(); };
  }, []);

  function setUpManually() {
    setError("");
    setOverview({ description: purpose.trim() || null, brief: { goal: purpose.trim() || null, currentFocus: null, importantDecisions: null, openQuestions: null, next: null } });
  }

  async function draft() {
    if (working || !name.trim()) return;
    setWorking("draft");
    setError("");
    try {
      const result = await draftRoomAction({ name, description: purpose.trim() || null });
      if (result.error || !result.data) setError(result.error ?? "Nibie couldn't draft this room. Please try again.");
      else setOverview(result.data);
    } catch { setError("Nibie couldn't draft this room. Try again or set it up manually."); }
    finally { setWorking(null); }
  }

  async function create() {
    if (working || !overview || !name.trim()) return;
    setWorking("save");
    setError("");
    try {
      const result = await onCreate({ name, description: overview.description?.trim() || null }, overview.brief);
      if (result.error) setError(result.error);
      else onClose();
    } catch { setError("We couldn't create this room. Please try again."); }
    finally { setWorking(null); }
  }

  return <dialog ref={dialogRef} className="room-setup-dialog" aria-labelledby={titleId} aria-busy={working !== null} onCancel={(event) => { event.preventDefault(); if (!working) onClose(); }}>
    <header className="settings-header"><h1 id={titleId}>{overview ? "Make this room yours" : "Create a room"}</h1><button type="button" className="icon-button" aria-label="Close room setup" disabled={working !== null} onClick={onClose}><X size={18} /></button></header>
    <form className="room-setup-form" onSubmit={(event) => { event.preventDefault(); if (overview) void create(); else if (preview) setUpManually(); else void draft(); }}>
      <p className="room-setup-copy">{overview ? "Review the description and brief. Rewrite anything before creating your room. You can also edit these later." : "Give your room a name. Nibie will draft a description and brief to help you get started."}</p>
      <label className="room-field"><span>Room name</span><input value={name} maxLength={roomNameLimit} required disabled={working !== null} placeholder="e.g. Backend interview preparation" onChange={(event) => setName(event.target.value)} /></label>
      {overview ? <>
        <label className="room-field"><span>Description</span><textarea value={overview.description ?? ""} maxLength={roomDescriptionLimit} rows={3} disabled={working !== null} onChange={(event) => setOverview({ ...overview, description: event.target.value })} /></label>
        <h2>Starting brief</h2>
        {roomBriefFields.map((field) => <label className="room-field" key={field.key}><span>{field.label}</span><textarea value={overview.brief[field.key] ?? ""} maxLength={roomBriefFieldLimit} rows={2} disabled={working !== null} onChange={(event) => setOverview({ ...overview, brief: { ...overview.brief, [field.key]: event.target.value } })} /></label>)}
      </> : <label className="room-field"><span>What would you like to achieve here? (optional)</span><textarea value={purpose} maxLength={roomDescriptionLimit} rows={3} disabled={working !== null} placeholder="e.g. Prepare for a Java interview in two weeks" onChange={(event) => setPurpose(event.target.value)} /></label>}
      {preview ? <p className="room-setup-copy">This is a mock workspace. AI drafting and saving to your account are available after sign-in.</p> : null}
      {error ? <p className="privacy-error" role="alert">{error}</p> : null}
      <p className="room-setup-status" role="status">{working === "draft" ? "Nibie is preparing your room…" : working === "save" ? "Creating your room…" : ""}</p>
      <div className="room-setup-actions">
        {overview ? <button type="button" className="privacy-button" disabled={working !== null} onClick={() => { setOverview(null); setError(""); }}>Back</button> : <button type="button" className="privacy-button" disabled={working !== null || !name.trim()} onClick={setUpManually}>Set up manually</button>}
        <button type="submit" className="privacy-button" disabled={working !== null || !name.trim()}>{overview ? "Create room" : preview ? "Continue" : "Draft my room"}</button>
      </div>
    </form>
  </dialog>;
}
