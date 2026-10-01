"use client";

import { memo, useMemo, useSyncExternalStore, type RefObject } from "react";
import { MessageSquare, Pencil, Plus, Trash2, X } from "lucide-react";
import { signOutAction } from "@/app/actions/auth";
import { Brand } from "@/components/brand";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { groupFor, historyGroups } from "@/lib/chat/groups";
import type { ConversationSummary } from "@/lib/chat/read";

const noopSubscribe = () => () => undefined;

type Props = {
  conversations: ConversationSummary[];
  activeId: string | null;
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
  onNewChat: () => void;
  onOpenSettings: () => void;
  onRename: (item: ConversationSummary) => void;
  onDelete: (item: ConversationSummary) => void;
};

// Memoized: streaming tokens and typing never re-render the history list.
export const ChatSidebar = memo(function ChatSidebar({ conversations, activeId, busy, preview, email, renderedAt, mobile = false, drawerRef, closeMenuRef, onClose, onOpen, onNewChat, onOpenSettings, onRename, onDelete }: Props) {
  // Server render and hydration group by the UTC calendar from the server's clock so both agree; once mounted, the viewer's own clock and
  // time zone are used (the grouping is recomputed whenever the list changes).
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const now = useMemo(() => (mounted ? Date.now() : renderedAt ?? 0), [mounted, renderedAt]);
  return <aside ref={mobile ? drawerRef : undefined} className={mobile ? "workspace-sidebar mobile-sidebar" : "workspace-sidebar desktop-sidebar"} aria-label={mobile ? "Conversation menu" : "Conversation history"} role={mobile ? "dialog" : undefined} aria-modal={mobile ? true : undefined}>
    <div className="sidebar-top"><Brand href="/" label="Nibie home" />{mobile && <button ref={closeMenuRef} className="icon-button" aria-label="Close menu" onClick={onClose}><X size={19} /></button>}</div>
    <button className="new-chat-button" disabled={busy} onClick={onNewChat}><Plus size={17} strokeWidth={2.2} /> <span>New chat</span></button>
    <nav className="history-nav" aria-label="Conversations">{historyGroups.map((group) => { const entries = conversations.filter((item) => groupFor(item.updated_at, now, mounted ? undefined : "UTC") === group); if (!entries.length) return null; return <section className="history-group" key={group} aria-label={group}><h2>{group}</h2>{entries.map((item) => <div className="history-entry" key={item.id}><button className={`history-item ${activeId === item.id ? "is-active" : ""}`} onClick={() => onOpen(item.id)} title={item.title}><MessageSquare size={15} /><span>{item.title}</span></button>{!preview && <><button className="history-action" aria-label={`Rename ${item.title}`} onClick={() => onRename(item)}><Pencil size={13} /></button><button className="history-action" aria-label={`Delete ${item.title}`} disabled={item.id === activeId && busy} onClick={() => onDelete(item)}><Trash2 size={13} /></button></>}</div>)}</section>; })}</nav>
    <div className="account-area"><button type="button" className="account-card" aria-label="Settings" onClick={onOpenSettings}><div className="avatar" aria-hidden="true">{email.slice(0, 1).toUpperCase()}</div><span className="account-email" title={email}>{email}</span></button><div className="account-actions"><form action={signOutAction}><button className="signout-button" type="submit">Sign out</button></form><ThemeSwitcher /></div></div>
  </aside>;
});
