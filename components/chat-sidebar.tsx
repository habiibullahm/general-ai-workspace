"use client";

import { memo, type RefObject } from "react";
import Link from "next/link";
import { ChevronDown, MessageSquare, Pencil, Plus, Trash2, X } from "lucide-react";
import { signOutAction } from "@/app/actions/auth";
import type { ConversationSummary } from "@/lib/chat/read";

const groups = ["Today", "Yesterday", "Older"] as const;

function groupFor(dateValue: string) {
  const date = new Date(dateValue);
  const today = new Date();
  const day = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const difference = Math.floor((day(today) - day(date)) / 86400000);
  return difference <= 0 ? "Today" : difference === 1 ? "Yesterday" : "Older";
}

type Props = {
  conversations: ConversationSummary[];
  activeId: string | null;
  busy: boolean;
  preview: boolean;
  email: string;
  mobile?: boolean;
  drawerRef?: RefObject<HTMLElement | null>;
  closeMenuRef?: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onOpen: (id: string | null) => void;
  onNewChat: () => void;
  onRename: (item: ConversationSummary) => void;
  onDelete: (item: ConversationSummary) => void;
};

// Memoized: streaming tokens and typing never re-render the history list.
export const ChatSidebar = memo(function ChatSidebar({ conversations, activeId, busy, preview, email, mobile = false, drawerRef, closeMenuRef, onClose, onOpen, onNewChat, onRename, onDelete }: Props) {
  return <aside ref={mobile ? drawerRef : undefined} className={mobile ? "workspace-sidebar mobile-sidebar" : "workspace-sidebar desktop-sidebar"} aria-label={mobile ? "Conversation menu" : "Conversation history"} role={mobile ? "dialog" : undefined} aria-modal={mobile ? true : undefined}>
    <div className="sidebar-top"><Link href="/" className="brand-lockup" aria-label="Nibie home"><span className="brand-mark">n</span><span>nibie</span></Link>{mobile && <button ref={closeMenuRef} className="icon-button" aria-label="Close menu" onClick={onClose}><X size={19} /></button>}</div>
    <button className="new-chat-button" disabled={busy} onClick={onNewChat}><Plus size={17} strokeWidth={2.2} /> <span>New chat</span></button>
    <nav className="history-nav" aria-label="Conversations">{groups.map((group) => { const entries = conversations.filter((item) => groupFor(item.updated_at) === group); if (!entries.length) return null; return <section className="history-group" key={group} aria-label={group}><h2>{group}</h2>{entries.map((item) => <div className="history-entry" key={item.id}><button className={`history-item ${activeId === item.id ? "is-active" : ""}`} onClick={() => onOpen(item.id)} title={item.title}><MessageSquare size={15} /><span>{item.title}</span></button>{!preview && <><button className="history-action" aria-label={`Rename ${item.title}`} onClick={() => onRename(item)}><Pencil size={13} /></button><button className="history-action" aria-label={`Delete ${item.title}`} disabled={item.id === activeId && busy} onClick={() => onDelete(item)}><Trash2 size={13} /></button></>}</div>)}</section>; })}</nav>
    <div className="account-area"><div className="account-card"><div className="avatar">{email.slice(0, 1).toUpperCase()}</div><span className="account-email" title={email}>{email}</span><ChevronDown size={15} /></div><form action={signOutAction}><button className="signout-button" type="submit">Sign out</button></form></div>
  </aside>;
});
