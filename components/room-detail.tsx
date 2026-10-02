"use client";

import { useState, useSyncExternalStore } from "react";
import { Plus } from "lucide-react";
import type { ConversationSummary, RoomSummary } from "@/lib/chat/read";
import { roomBriefFields, type RoomBriefFields } from "@/lib/rooms/types";

type SaveResult = { error?: string };
const noopSubscribe = () => () => undefined;

type Props = {
  room: RoomSummary;
  threads: ConversationSummary[];
  busy: boolean;
  onOpenThread: (id: string) => void;
  onNewThread: () => void;
  onSaveRoom: (patch: { name: string; description: string | null; instructions: string | null }) => Promise<SaveResult>;
  onSaveBrief: (brief: RoomBriefFields) => Promise<SaveResult>;
  onDelete: () => Promise<SaveResult>;
};

function briefFromRoom(room: RoomSummary): RoomBriefFields {
  return {
    goal: room.brief?.goal ?? null,
    currentFocus: room.brief?.current_focus ?? null,
    importantDecisions: room.brief?.important_decisions ?? null,
    openQuestions: room.brief?.open_questions ?? null,
    next: room.brief?.next_step ?? null,
  };
}

export function RoomDetail({ room, threads, busy, onOpenThread, onNewThread, onSaveRoom, onSaveBrief, onDelete }: Props) {
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const [name, setName] = useState(room.name);
  const [description, setDescription] = useState(room.description ?? "");
  const [instructions, setInstructions] = useState(room.instructions ?? "");
  const [brief, setBrief] = useState(() => briefFromRoom(room));
  const [savedStamp, setSavedStamp] = useState(`${room.updated_at}:${JSON.stringify(room.brief)}`);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState<"room" | "brief" | "delete" | null>(null);
  const stamp = `${room.updated_at}:${JSON.stringify(room.brief)}`;
  if (stamp !== savedStamp) {
    setSavedStamp(stamp);
    setName(room.name);
    setDescription(room.description ?? "");
    setInstructions(room.instructions ?? "");
    setBrief(briefFromRoom(room));
  }

  async function saveRoom() {
    setSaving("room");
    setError("");
    const result = await onSaveRoom({ name, description: description.trim() || null, instructions: instructions.trim() || null });
    setSaving(null);
    if (result.error) setError(result.error);
  }

  async function saveBrief() {
    setSaving("brief");
    setError("");
    const result = await onSaveBrief({
      goal: brief.goal?.trim() || null,
      currentFocus: brief.currentFocus?.trim() || null,
      importantDecisions: brief.importantDecisions?.trim() || null,
      openQuestions: brief.openQuestions?.trim() || null,
      next: brief.next?.trim() || null,
    });
    setSaving(null);
    if (result.error) setError(result.error);
  }

  async function remove() {
    if (!window.confirm(`Delete “${room.name}”? Threads in this room become general threads.`)) return;
    setSaving("delete");
    setError("");
    const result = await onDelete();
    setSaving(null);
    if (result.error) setError(result.error);
  }

  const locked = !mounted || busy || saving !== null;

  return <div className="room-detail">
    <p className="welcome-eyebrow">Room</p>
    <div className="room-fields">
      <label className="room-field"><span>Name</span><input value={name} maxLength={80} disabled={locked} onChange={(event) => setName(event.target.value)} /></label>
      <label className="room-field"><span>Description</span><textarea value={description} maxLength={500} rows={3} disabled={locked} onChange={(event) => setDescription(event.target.value)} placeholder="What this room is for" /></label>
      <label className="room-field"><span>Instructions</span><textarea value={instructions} maxLength={2000} rows={5} disabled={locked} onChange={(event) => setInstructions(event.target.value)} placeholder="How Nibie should work in this room" /></label>
      <button type="button" className="privacy-button" disabled={locked || !name.trim()} onClick={() => void saveRoom()}>{saving === "room" ? "Saving…" : "Save room"}</button>
    </div>
    <section className="room-brief" aria-label="Room brief">
      <h2>Brief</h2>
      <p>A short, editable picture of this room. Nibie uses it as context in threads here.</p>
      {roomBriefFields.map((field) => <label className="room-field" key={field.key}><span>{field.label}</span><textarea value={brief[field.key] ?? ""} maxLength={500} rows={3} disabled={locked} onChange={(event) => setBrief((current) => ({ ...current, [field.key]: event.target.value }))} /></label>)}
      <button type="button" className="privacy-button" disabled={locked} onClick={() => void saveBrief()}>{saving === "brief" ? "Saving…" : "Save brief"}</button>
    </section>
    <section className="room-threads" aria-label="Threads">
      <div className="room-threads-head"><h2>Threads</h2><button type="button" className="privacy-button" disabled={locked} onClick={onNewThread}><Plus size={15} aria-hidden="true" /> New thread</button></div>
      {threads.length ? <ul>{threads.map((thread) => <li key={thread.id}><button type="button" onClick={() => onOpenThread(thread.id)}>{thread.title}</button></li>)}</ul> : <p>No threads in this room yet.</p>}
    </section>
    {error ? <p className="privacy-error" role="status">{error}</p> : null}
    <button type="button" className="privacy-button is-danger" disabled={locked} onClick={() => void remove()}>{saving === "delete" ? "Deleting…" : "Delete room"}</button>
  </div>;
}
