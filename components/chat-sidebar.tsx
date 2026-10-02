"use client";

import { memo, useMemo, useState, useSyncExternalStore, type RefObject } from "react";
import { DoorOpen, MessageSquare, Pencil, Plus, Settings, Trash2, X } from "lucide-react";
import { signOutAction } from "@/app/actions/auth";
import { SIGN_OUT_LABEL } from "@/lib/privacy/sign-out";
import { Brand } from "@/components/brand";
import { chatPath } from "@/lib/routes";
import { groupFor, historyGroups } from "@/lib/chat/groups";
import type { ConversationSummary, RoomSummary } from "@/lib/chat/read";

const noopSubscribe = () => () => undefined;

type Props = {
  conversations: ConversationSummary[];
  rooms: RoomSummary[];
  activeId: string | null;
  activeRoomId: string | null;
  busy: boolean;
  preview: boolean;
  email: string;
  // The server's clock when the page was rendered; used (with the UTC calendar) until hydration has finished.
  renderedAt?: number;
  mobile?: boolean;
  drawerRef?: RefObject<HTMLElement | null>;
  closeMenuRef?: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onOpen: (id: string | null) => void;
  onOpenRoom: (id: string) => void;
  onCreateRoom: (name: string) => Promise<{ error?: string }>;
  onNewChat: () => void;
  onOpenSettings: () => void;
  onRename: (item: ConversationSummary) => void;
  onDelete: (item: ConversationSummary) => void;
};

// Memoized: streaming tokens and typing never re-render the history list.
export const ChatSidebar = memo(function ChatSidebar({ conversations, rooms, activeId, activeRoomId, busy, preview, email, renderedAt, mobile = false, drawerRef, closeMenuRef, onClose, onOpen, onOpenRoom, onCreateRoom, onNewChat, onOpenSettings, onRename, onDelete }: Props) {
  // Server render and hydration group by the UTC calendar from the server's clock so both agree; once mounted, the viewer's own clock and
  // time zone are used (the grouping is recomputed whenever the list changes).
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const now = useMemo(() => (mounted ? Date.now() : renderedAt ?? 0), [mounted, renderedAt]);
  const [creating, setCreating] = useState(false);
  const [roomName, setRoomName] = useState("");
  const [createError, setCreateError] = useState("");
  return <aside ref={mobile ? drawerRef : undefined} className={mobile ? "workspace-sidebar mobile-sidebar" : "workspace-sidebar desktop-sidebar"} aria-label={mobile ? "Conversation menu" : "Conversation history"} role={mobile ? "dialog" : undefined} aria-modal={mobile ? true : undefined}>
    <div className="sidebar-top"><Brand href={chatPath} label="Nibie home" />{mobile && <button ref={closeMenuRef} className="icon-button" aria-label="Close menu" onClick={onClose}><X size={19} /></button>}</div>
    <button className="new-chat-button" disabled={busy} onClick={onNewChat}><Plus size={17} strokeWidth={2.2} /> <span>New chat</span></button>
    <nav className="history-nav" aria-label="Conversations"><section className="history-group" aria-label="Rooms"><h2>Rooms</h2>{rooms.map((room) => <div className="history-entry" key={room.id}><button className={`history-item ${activeRoomId === room.id && !activeId ? "is-active" : ""}`} onClick={() => onOpenRoom(room.id)} title={room.name}><DoorOpen size={15} /><span>{room.name}</span></button></div>)}{creating ? <form className="room-create" onSubmit={(event) => { event.preventDefault(); const name = roomName.trim(); if (!name || busy) return; void onCreateRoom(name).then((result) => { if (result.error) { setCreateError(result.error); return; } setRoomName(""); setCreateError(""); setCreating(false); }); }}><input aria-label="Room name" value={roomName} maxLength={80} placeholder="Room name" onChange={(event) => setRoomName(event.target.value)} /><button type="submit" disabled={busy || !roomName.trim()}>Create</button><button type="button" onClick={() => { setCreating(false); setRoomName(""); setCreateError(""); }}>Cancel</button>{createError ? <p role="status">{createError}</p> : null}</form> : <button className="history-item" disabled={busy} onClick={() => { setCreating(true); setCreateError(""); }}><Plus size={15} /><span>New room</span></button>}</section>{historyGroups.map((group) => { const entries = conversations.filter((item) => groupFor(item.updated_at, now, mounted ? undefined : "UTC") === group); if (!entries.length) return null; return <section className="history-group" key={group} aria-label={group}><h2>{group}</h2>{entries.map((item) => <div className="history-entry" key={item.id} data-conversation-id={item.id}><button className={`history-item ${activeId === item.id ? "is-active" : ""}`} onClick={() => onOpen(item.id)} title={item.title}><MessageSquare size={15} /><span>{item.title}</span></button>{!preview && <><button className="history-action" aria-label={`Rename ${item.title}`} onClick={() => onRename(item)}><Pencil size={13} /></button><button className="history-action" aria-label={`Delete ${item.title}`} disabled={item.id === activeId && busy} onClick={() => onDelete(item)}><Trash2 size={13} /></button></>}</div>)}</section>; })}</nav>
    <div className="account-area"><div className="account-row"><div className="account-profile"><div className="avatar" aria-hidden="true">{email.slice(0, 1).toUpperCase()}</div><form action={signOutAction}><button className="signout-button" type="submit">{SIGN_OUT_LABEL}</button></form></div><span className="account-email" title={email}>{email}</span><button type="button" className="icon-button account-settings" aria-label="Settings" onClick={onOpenSettings}><Settings size={16} aria-hidden="true" /></button></div></div>
  </aside>;
});
