"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowUp, ChevronDown, FilePlus2, Menu, MessageSquare, Plus, Sparkles, X, Pencil, Trash2 } from "lucide-react";
import { signOutAction } from "@/app/actions/auth";
import { addUserMessageAction, createConversationAction, deleteConversationAction, renameConversationAction, updateConversationModelAction } from "@/app/actions/chat";
import type { ConversationSummary, PersistedMessage } from "@/lib/chat/read";
import type { ChatModel } from "@/lib/chat/validation";

type Conversation = ConversationSummary & { messages: PersistedMessage[] };
type WorkspaceData = { conversations: ConversationSummary[]; messages: PersistedMessage[]; activeId: string | null; error: string | null };
const suggestions = ["Help me think through an idea", "Write something with me", "Explain a new topic"];
const mockConversations: Conversation[] = [
  { id: "preview-writing", title: "A thoughtful note to the team", selected_model: "Balanced", created_at: new Date().toISOString(), updated_at: new Date().toISOString(), messages: [{ id: "p1", role: "user", content: "Help me write a thoughtful note to my team after a busy launch week.", position: 1 }, { id: "p2", role: "assistant", content: "A good note can recognize the effort, name what the team accomplished, and leave room for everyone to recharge.\n\nYou might start with what you noticed most: the care people brought to the final details, the way they supported one another, or a moment that made you proud.", position: 2 }] },
  { id: "preview-learning", title: "Learning the basics of astronomy", selected_model: "Balanced", created_at: new Date(Date.now() - 86400000).toISOString(), updated_at: new Date(Date.now() - 86400000).toISOString(), messages: [{ id: "p3", role: "user", content: "Where should I begin if I want to learn astronomy?", position: 1 }, { id: "p4", role: "assistant", content: "Start by looking up. Learning a few bright constellations and the phases of the Moon gives you a useful map. From there, the scale of the solar system becomes much easier to picture.", position: 2 }] },
];

function groupFor(dateValue: string) {
  const date = new Date(dateValue);
  const today = new Date();
  const day = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const difference = Math.floor((day(today) - day(date)) / 86400000);
  return difference <= 0 ? "Today" : difference === 1 ? "Yesterday" : "Older";
}

export function ChatWorkspace({ email, initialData, preview = false }: { email: string; initialData?: WorkspaceData; preview?: boolean }) {
  const router = useRouter();
  const conversations = preview ? mockConversations : (initialData?.conversations ?? []);
  const [localMessages, setLocalMessages] = useState<Record<string, PersistedMessage[]>>({});
  const [localConversations, setLocalConversations] = useState<ConversationSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(initialData?.activeId ?? (preview ? null : null));
  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState<ChatModel>((conversations.find((item) => item.id === activeId)?.selected_model as ChatModel) ?? "Balanced");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState(initialData?.error ?? "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeMenuRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const shownConversations = [...new Map([...conversations, ...localConversations].map((item) => [item.id, item])).values()]
    .sort((left, right) => right.updated_at.localeCompare(left.updated_at) || left.id.localeCompare(right.id));
  const activeConversation = shownConversations.find((item) => item.id === activeId);
  const messages = preview ? [...((activeConversation as Conversation | undefined)?.messages ?? []), ...(localMessages[activeId ?? ""] ?? [])] : activeId === initialData?.activeId ? initialData.messages : localMessages[activeId ?? ""] ?? [];

  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "0px";
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
  }, [draft]);
  useEffect(() => {
    if (!drawerOpen) return;
    closeMenuRef.current?.focus();
    function handleKeydown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") { setDrawerOpen(false); menuButtonRef.current?.focus(); return; }
      if (event.key !== "Tab") return;
      const focusable = drawerRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
      if (!focusable?.length) return;
      if (event.shiftKey && document.activeElement === focusable[0]) { event.preventDefault(); focusable[focusable.length - 1].focus(); }
      else if (!event.shiftKey && document.activeElement === focusable[focusable.length - 1]) { event.preventDefault(); focusable[0].focus(); }
    }
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [drawerOpen]);

  function openConversation(id: string | null) {
    setActiveId(id); setNotice(""); setDrawerOpen(false);
    const item = shownConversations.find((conversation) => conversation.id === id);
    if (item) setMode((item.selected_model as ChatModel) ?? "Balanced");
    if (!preview) router.push(id ? `/?conversation=${encodeURIComponent(id)}` : "/");
    requestAnimationFrame(() => menuButtonRef.current?.focus());
  }
  async function newChat() {
    setNotice(""); setDraft(""); setDrawerOpen(false);
    if (preview) { openConversation(null); return; }
    const result = await createConversationAction(mode);
    if (result.error || !result.data) { setNotice(result.error ?? "Conversation couldn't be created."); return; }
    setLocalConversations((items) => [result.data!, ...items]);
    setLocalMessages((items) => ({ ...items, [result.data!.id]: [] }));
    openConversation(result.data.id);
  }
  async function submitMessage(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true); setNotice("");
    if (preview) {
      const id = activeId ?? `preview-local-${Date.now()}`;
      const item = activeConversation ?? { id, title: content.slice(0, 42), selected_model: mode, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      const row: PersistedMessage = { id: `local-${Date.now()}`, role: "user", content, position: messages.length + 1 };
      if (!activeConversation) setLocalConversations((items) => [item, ...items]);
      setLocalMessages((items) => ({ ...items, [id]: [...(items[id] ?? []), row] }));
      setActiveId(id); setDraft(""); setNotice("Your message is shown in this local preview. Replies are not connected yet.");
      setSending(false); return;
    }
    let id = activeId;
    if (!id) {
      const created = await createConversationAction(mode);
      if (created.error || !created.data) { setNotice(created.error ?? "Conversation couldn't be created."); setSending(false); return; }
      id = created.data.id;
      setLocalConversations((items) => [created.data!, ...items]);
      setLocalMessages((items) => ({ ...items, [id!]: [] }));
      setActiveId(id);
      router.push(`/?conversation=${encodeURIComponent(id)}`);
    }
    const result = await addUserMessageAction(id, content);
    if (result.error) { setNotice(result.error); setSending(false); return; }
    setLocalMessages((items) => ({ ...items, [id!]: [...(items[id!] ?? (id === initialData?.activeId ? initialData.messages : [])), { id: `pending-${Date.now()}`, role: "user", content, position: messages.length + 1 }] }));
    setLocalConversations((items) => items.map((item) => item.id === id ? { ...item, title: item.title === "New chat" ? content.slice(0, 42) + (content.length > 42 ? "…" : "") : item.title, updated_at: new Date().toISOString() } : item));
    setDraft(""); router.refresh(); setSending(false);
  }
  async function changeMode(value: string) {
    const next = value as ChatModel; setMode(next);
    if (activeId && !preview) { const result = await updateConversationModelAction(activeId, next); if (result.error) setNotice(result.error); }
  }
  async function rename(item: ConversationSummary) {
    if (preview) return;
    const title = window.prompt("Conversation title", item.title);
    if (title === null) return;
    const result = await renameConversationAction(item.id, title);
    if (result.error) { setNotice(result.error); return; }
    setLocalConversations((items) => {
      const renamed = { ...item, title: title.trim(), updated_at: new Date().toISOString() };
      return items.some((entry) => entry.id === item.id) ? items.map((entry) => entry.id === item.id ? renamed : entry) : [renamed, ...items];
    });
    router.refresh();
  }
  async function remove(item: ConversationSummary) {
    if (preview || !window.confirm(`Delete “${item.title}”?`)) return;
    const result = await deleteConversationAction(item.id);
    if (result.error) { setNotice(result.error); return; }
    setLocalConversations((items) => items.filter((entry) => entry.id !== item.id));
    setLocalMessages((items) => { const next = { ...items }; delete next[item.id]; return next; });
    if (activeId === item.id) openConversation(null);
    router.refresh();
  }
  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void submitMessage(); } }

  const groups = ["Today", "Yesterday", "Older"] as const;
  const sidebar = (mobile = false) => <aside ref={mobile ? drawerRef : undefined} className={mobile ? "workspace-sidebar mobile-sidebar" : "workspace-sidebar desktop-sidebar"} aria-label={mobile ? "Conversation menu" : "Conversation history"} role={mobile ? "dialog" : undefined} aria-modal={mobile ? true : undefined}>
    <div className="sidebar-top"><Link href="/" className="brand-lockup" aria-label="Nibie home"><span className="brand-mark">n</span><span>nibie</span></Link>{mobile && <button ref={closeMenuRef} className="icon-button" aria-label="Close menu" onClick={() => { setDrawerOpen(false); menuButtonRef.current?.focus(); }}><X size={19} /></button>}</div>
    <button className="new-chat-button" onClick={() => void newChat()}><Plus size={17} strokeWidth={2.2} /> <span>New chat</span></button>
    <nav className="history-nav" aria-label="Conversations">{groups.map((group) => { const entries = shownConversations.filter((item) => groupFor(item.updated_at) === group); if (!entries.length) return null; return <section className="history-group" key={group} aria-label={group}><h2>{group}</h2>{entries.map((item) => <div className="history-entry" key={item.id}><button className={`history-item ${activeId === item.id ? "is-active" : ""}`} onClick={() => openConversation(item.id)} title={item.title}><MessageSquare size={15} /><span>{item.title}</span></button>{!preview && <><button className="history-action" aria-label={`Rename ${item.title}`} onClick={() => void rename(item)}><Pencil size={13} /></button><button className="history-action" aria-label={`Delete ${item.title}`} onClick={() => void remove(item)}><Trash2 size={13} /></button></>}</div>)}</section>; })}</nav>
    <div className="account-area"><div className="account-card"><div className="avatar">{email.slice(0, 1).toUpperCase()}</div><span className="account-email" title={email}>{email}</span><ChevronDown size={15} /></div><form action={signOutAction}><button className="signout-button" type="submit">Sign out</button></form></div>
  </aside>;

  return <main className="chat-workspace">{sidebar()}{drawerOpen && <div className="mobile-drawer"><button className="drawer-scrim" aria-label="Dismiss menu backdrop" onClick={() => { setDrawerOpen(false); menuButtonRef.current?.focus(); }} />{sidebar(true)}</div>}
    <section className="chat-main" aria-label="Chat workspace"><header className="chat-header"><button ref={menuButtonRef} className="icon-button mobile-menu-button" aria-label="Open conversation menu" onClick={() => setDrawerOpen(true)}><Menu size={21} /></button><div className="header-model"><span className="model-dot" /><span>Nibie</span><span className="header-divider">/</span><span className="header-context">A little room to think</span></div><button className="header-new-chat" onClick={() => void newChat()}><Plus size={16} /><span>New chat</span></button></header>
      <div className={`conversation-scroll ${messages.length ? "has-messages" : "is-empty"}`}>{messages.length ? <div className="message-list" aria-live="polite">{messages.map((message) => <article className={`message-row ${message.role}`} key={message.id}><div className={`message-content ${message.role}`}>{message.role === "assistant" && <div className="message-author">Nibie</div>}<p>{message.content}</p></div>{message.role === "user" && <div className="user-avatar" aria-label="You">{email.slice(0, 1).toUpperCase()}</div>}</article>)}{notice && <p className="local-notice" role="status">{notice}</p>}</div> : <div className="welcome-panel">{notice && <p className="local-notice" role="status">{notice}</p>}<div className="welcome-icon"><Sparkles size={19} strokeWidth={1.7} /></div><p className="welcome-eyebrow">A LITTLE ROOM TO THINK</p><h1>What’s on your mind?</h1><p className="welcome-copy">A fresh page for ideas, questions, and whatever you’re working through.</p><div className="suggestion-list" aria-label="Suggestions">{suggestions.map((suggestion) => <button key={suggestion} onClick={() => { setDraft(suggestion); textareaRef.current?.focus(); }}>{suggestion}<span>↗</span></button>)}</div></div>}</div>
      <div className="composer-dock"><form className="composer" onSubmit={(event) => void submitMessage(event)}><textarea ref={textareaRef} aria-label="Message Nibie" placeholder="Message Nibie…" value={draft} rows={1} onChange={(event) => setDraft(event.target.value)} onKeyDown={handleKeyDown} /><div className="composer-tools"><div className="composer-left-tools"><button className="composer-icon" type="button" aria-label="Attach a file" title="Attachments are not available" onClick={() => setNotice("Attachments are not available yet.")}><FilePlus2 size={18} /></button><label className="mode-select-label" htmlFor="response-mode">Response mode</label><select id="response-mode" aria-label="Response mode" value={mode} onChange={(event) => void changeMode(event.target.value)}><option>Fast</option><option>Balanced</option><option>Reasoning</option></select><ChevronDown className="select-chevron" size={13} aria-hidden="true" /></div><button className="send-button" type="submit" aria-label="Send message" disabled={!draft.trim() || sending}>{sending ? <span className="send-spinner" /> : <ArrowUp size={18} strokeWidth={2.3} />}</button></div></form><p className="composer-caption">{preview ? "Mock workspace · Messages stay in this tab and are not saved." : "Your conversations are saved to your account."}</p></div>
    </section></main>;
}
