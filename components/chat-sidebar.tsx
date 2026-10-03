"use client";

import { memo, useMemo, useSyncExternalStore, type RefObject } from "react";
import Link from "next/link";
import { DoorOpen, FileText, MessageSquare, Pencil, Plus, Settings, Trash2, X } from "lucide-react";
import { SIGN_OUT_LABEL } from "@/lib/privacy/sign-out";
import { AccountMenu } from "@/components/account-menu";
import { Brand } from "@/components/brand";
import { chatPath, workbenchPath } from "@/lib/routes";
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
  name: string;
  // The server's clock when the page was rendered; used (with the UTC calendar) until hydration has finished.
  renderedAt?: number;
  mobile?: boolean;
  drawerRef?: RefObject<HTMLElement | null>;
  closeMenuRef?: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onOpen: (id: string | null) => void;
  onOpenRoom: (id: string) => void;
  onCreateRoom: () => void;
  onNewChat: () => void;
  onOpenSettings: () => void;
  onRename: (item: ConversationSummary) => void;
  onDelete: (item: ConversationSummary) => void;
};

// Memoized: streaming tokens and typing never re-render the history list.
export const ChatSidebar = memo(function ChatSidebar({ conversations, rooms, activeId, activeRoomId, busy, preview, email, name, renderedAt, mobile = false, drawerRef, closeMenuRef, onClose, onOpen, onOpenRoom, onCreateRoom, onNewChat, onOpenSettings, onRename, onDelete }: Props) {
  // Server render and hydration group by the UTC calendar from the server's clock so both agree; once mounted, the viewer's own clock and
  // time zone are used (the grouping is recomputed whenever the list changes).
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const now = useMemo(() => (mounted ? Date.now() : renderedAt ?? 0), [mounted, renderedAt]);
  return <aside ref={mobile ? drawerRef : undefined} className={mobile ? "workspace-sidebar mobile-sidebar" : "workspace-sidebar desktop-sidebar"} aria-label={mobile ? "Conversation menu" : "Conversation history"} role={mobile ? "dialog" : undefined} aria-modal={mobile ? true : undefined}>
    <div className="sidebar-top"><Brand href={chatPath} label="Nibie home" />{mobile && <button ref={closeMenuRef} className="icon-button" aria-label="Close menu" onClick={onClose}><X size={19} /></button>}</div>
    <button className="new-chat-button" disabled={busy} onClick={onNewChat}><Plus size={17} strokeWidth={2.2} /> <span>New chat</span></button>
    <Link className="new-chat-button sidebar-workbench" href={workbenchPath}><FileText size={17} strokeWidth={2.2} /> <span>Workbench</span></Link>
    <nav className="history-nav" aria-label="Conversations"><section className="history-group" aria-label="Rooms"><h2>Rooms</h2>{rooms.map((room) => <div className="history-entry" key={room.id}><button className={`history-item ${activeRoomId === room.id && !activeId ? "is-active" : ""}`} onClick={() => onOpenRoom(room.id)} title={room.name}><DoorOpen size={15} /><span>{room.name}</span></button></div>)}<button className="history-item" disabled={busy} onClick={onCreateRoom}><Plus size={15} /><span>New room</span></button></section>{historyGroups.map((group) => { const entries = conversations.filter((item) => groupFor(item.updated_at, now, mounted ? undefined : "UTC") === group); if (!entries.length) return null; return <section className="history-group" key={group} aria-label={group}><h2>{group}</h2>{entries.map((item) => <div className="history-entry" key={item.id} data-conversation-id={item.id}><button className={`history-item ${activeId === item.id ? "is-active" : ""}`} onClick={() => onOpen(item.id)} title={item.title}><MessageSquare size={15} /><span>{item.title}</span></button>{!preview && <><button className="history-action" aria-label={`Rename ${item.title}`} onClick={() => onRename(item)}><Pencil size={13} /></button><button className="history-action" aria-label={`Delete ${item.title}`} disabled={item.id === activeId && busy} onClick={() => onDelete(item)}><Trash2 size={13} /></button></>}</div>)}</section>; })}</nav>
    <div className="account-area"><div className="account-row"><AccountMenu email={email} name={name} signOutLabel={SIGN_OUT_LABEL} onOpenSettings={onOpenSettings} /><button type="button" className="icon-button account-settings" aria-label="Settings" onClick={onOpenSettings}><Settings size={16} aria-hidden="true" /></button></div></div>
  </aside>;
});
