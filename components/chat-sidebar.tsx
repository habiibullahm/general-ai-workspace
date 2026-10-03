"use client";

import { memo, useEffect, useMemo, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { Archive, DoorOpen, MessageSquare, PanelLeftClose, Pencil, Plus, RotateCcw, Settings, SquarePen, X } from "lucide-react";
import { SIGN_OUT_LABEL } from "@/lib/privacy/sign-out";
import { AccountMenu } from "@/components/account-menu";
import { Brand, type BrandActivity } from "@/components/brand";
import { chatPath } from "@/lib/routes";
import { groupFor, historyGroups } from "@/lib/chat/groups";
import type { ConversationSummary, RoomSummary } from "@/lib/chat/read";

const noopSubscribe = () => () => undefined;

type Props = {
  conversations: ConversationSummary[];
  archivedConversations: ConversationSummary[];
  rooms: RoomSummary[];
  activeId: string | null;
  activeRoomId: string | null;
  busy: boolean;
  activity: BrandActivity;
  preview: boolean;
  email: string;
  name: string;
  // The server's clock when the page was rendered; used (with the UTC calendar) until hydration has finished.
  renderedAt?: number;
  mobile?: boolean;
  drawerRef?: RefObject<HTMLElement | null>;
  closeMenuRef?: RefObject<HTMLButtonElement | null>;
  desktopToggleRef?: RefObject<HTMLButtonElement | null>;
  onCollapse?: () => void;
  onClose: () => void;
  onOpen: (id: string | null) => void;
  onOpenRoom: (id: string) => void;
  onCreateRoom: () => void;
  onNewChat: () => void;
  onOpenSettings: () => void;
  onRename: (item: ConversationSummary) => void;
  onArchive: (item: ConversationSummary) => void;
  onRestore: (item: ConversationSummary) => void;
};

// Memoized: streaming tokens and typing never re-render the history list.
export const ChatSidebar = memo(function ChatSidebar({ conversations, archivedConversations, rooms, activeId, activeRoomId, busy, activity, preview, email, name, renderedAt, mobile = false, drawerRef, closeMenuRef, desktopToggleRef, onCollapse, onClose, onOpen, onOpenRoom, onCreateRoom, onNewChat, onOpenSettings, onRename, onArchive, onRestore }: Props) {
  // Server render and hydration group by the UTC calendar from the server's clock so both agree; once mounted, the viewer's own clock and
  // time zone are used (the grouping is recomputed whenever the list changes).
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const now = useMemo(() => (mounted ? Date.now() : renderedAt ?? 0), [mounted, renderedAt]);
  const [contextMenu, setContextMenu] = useState<{ item: ConversationSummary; x: number; y: number } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const contextTriggerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!contextMenu) return;
    contextMenuRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const dismissOutside = (event: PointerEvent) => { if (!contextMenuRef.current?.contains(event.target as Node)) setContextMenu(null); };
    const dismissEscape = (event: KeyboardEvent) => { if (event.key === "Escape") { setContextMenu(null); contextTriggerRef.current?.focus(); } };
    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("keydown", dismissEscape);
    return () => { document.removeEventListener("pointerdown", dismissOutside); document.removeEventListener("keydown", dismissEscape); };
  }, [contextMenu]);
  return <aside ref={mobile ? drawerRef : undefined} className={mobile ? "workspace-sidebar mobile-sidebar" : "workspace-sidebar desktop-sidebar"} aria-label={mobile ? "Conversation menu" : "Conversation history"} role={mobile ? "dialog" : undefined} aria-modal={mobile ? true : undefined}>
    <div className="sidebar-top"><Brand href={chatPath} label="Nibie home" activity={activity} />{mobile ? <button ref={closeMenuRef} className="icon-button" aria-label="Close menu" onClick={onClose}><X size={19} /></button> : onCollapse ? <button ref={desktopToggleRef} className="icon-button" aria-label="Collapse sidebar" title="Collapse sidebar" onClick={onCollapse}><PanelLeftClose size={18} /></button> : null}</div>
    <button className="new-chat-button" disabled={busy} onClick={onNewChat}><SquarePen size={17} /> <span>New chat</span></button>
    <nav className="history-nav" aria-label="Conversations">
      <section className="history-group" aria-label="Rooms">
        <h2>Rooms</h2>
        {rooms.map((room) => <div className="history-entry" key={room.id}><button className={`history-item ${activeRoomId === room.id && !activeId ? "is-active" : ""}`} onClick={() => onOpenRoom(room.id)} title={room.name}><DoorOpen size={15} /><span>{room.name}</span></button></div>)}
        <button className="history-item" disabled={busy} onClick={onCreateRoom}><Plus size={15} /><span>New room</span></button>
      </section>
      {historyGroups.map((group) => {
        const entries = conversations.filter((item) => groupFor(item.updated_at, now, mounted ? undefined : "UTC") === group);
        if (!entries.length) return null;
        return <section className="history-group" key={group} aria-label={group}>
          <h2>{group}</h2>
          {entries.map((item) => <div className="history-entry" key={item.id} data-conversation-id={item.id} tabIndex={-1} onContextMenu={(event) => { if (preview) return; event.preventDefault(); contextTriggerRef.current = event.currentTarget; setContextMenu({ item, x: Math.max(8, Math.min(event.clientX, window.innerWidth - 192)), y: Math.max(8, Math.min(event.clientY, window.innerHeight - 132)) }); }}>
            <button className={`history-item ${activeId === item.id ? "is-active" : ""}`} onClick={(event) => { if (event.detail === 2) onRename(item); else if (event.detail === 1) onOpen(item.id); }} title={`${item.title} · Double-click to rename`}><MessageSquare size={15} /><span>{item.title}</span></button>
            {!preview && <button className="history-action" aria-label={`Archive ${item.title}`} title="Archive" onClick={() => onArchive(item)}><Archive size={13} /></button>}
          </div>)}
        </section>;
      })}
      {archivedConversations.length > 0 && <section className="history-group" aria-label="Archived">
        <h2>Archived</h2>
        {archivedConversations.map((item) => <div className="history-entry" key={item.id}>
          <span className="history-item archived-item" title={item.title}><Archive size={15} /><span>{item.title}</span></span>
          <button className="history-action" aria-label={`Restore ${item.title}`} title="Restore" onClick={() => onRestore(item)}><RotateCcw size={13} /></button>
        </div>)}
      </section>}
    </nav>
    {contextMenu && <div ref={contextMenuRef} className="history-context-menu" role="menu" aria-label={`Actions for ${contextMenu.item.title}`} tabIndex={-1} style={{ left: contextMenu.x, top: contextMenu.y }}><button type="button" role="menuitem" onClick={() => { setContextMenu(null); onRename(contextMenu.item); }}><Pencil size={14} />Rename</button><button type="button" role="menuitem" disabled={contextMenu.item.id === activeId && busy} onClick={() => { setContextMenu(null); onArchive(contextMenu.item); }}><Archive size={14} />Archive</button></div>}
    <div className="account-area"><div className="account-row"><AccountMenu email={email} name={name} signOutLabel={SIGN_OUT_LABEL} onOpenSettings={onOpenSettings} /><button type="button" className="icon-button account-settings" aria-label="Settings" onClick={onOpenSettings}><Settings size={16} aria-hidden="true" /></button></div></div>
  </aside>;
});
