"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowUp, ChevronDown, FilePlus2, Menu, MessageSquare, Plus, RefreshCw, Sparkles, X, Pencil, Trash2 } from "lucide-react";
import { signOutAction } from "@/app/actions/auth";
import { addUserMessageAction, createConversationAction, deleteConversationAction, editLastUserMessageAction, renameConversationAction, updateConversationModelAction } from "@/app/actions/chat";
import { CopyButton } from "@/components/copy-button";
import { MessageMarkdown } from "@/components/message-markdown";
import type { ConversationSummary, PersistedMessage } from "@/lib/chat/read";
import type { ChatModel } from "@/lib/chat/validation";
import { readChatSse } from "@/lib/ai/sse";

type Conversation = ConversationSummary & { messages: PersistedMessage[] };
type WorkspaceData = { conversations: ConversationSummary[]; messages: PersistedMessage[]; activeId: string | null; error: string | null };
type GenerateOptions = { regenerate?: boolean; replaceIds?: string[] };
const suggestions = ["Help me think through an idea", "Write something with me", "Explain a new topic"];
const placeholderResponses = new Set(["Response stopped.", "Response unavailable."]);
const mockConversations: Conversation[] = [
  { id: "preview-writing", title: "A thoughtful note to the team", selected_model: "Balanced", created_at: new Date().toISOString(), updated_at: new Date().toISOString(), messages: [{ id: "p1", role: "user", content: "Help me write a thoughtful note to my team after a busy launch week.", position: 1 }, { id: "p2", role: "assistant", content: "A good note can recognize the effort, name what the team accomplished, and leave room for everyone to recharge.\n\nYou might start with what you noticed most: the care people brought to the final details, the way they supported one another, or a moment that made you proud.", position: 2 }] },
  { id: "preview-learning", title: "Learning the basics of astronomy", selected_model: "Balanced", created_at: new Date(Date.now() - 86400000).toISOString(), updated_at: new Date(Date.now() - 86400000).toISOString(), messages: [{ id: "p3", role: "user", content: "Where should I begin if I want to learn astronomy?", position: 1 }, { id: "p4", role: "assistant", content: "Start by looking up. Learning a few bright constellations and the phases of the Moon gives you a useful map. From there, the scale of the solar system becomes much easier to picture.", position: 2 }] },
  { id: "preview-code", title: "Debouncing a search box", selected_model: "Balanced", created_at: new Date(Date.now() - 172800000).toISOString(), updated_at: new Date(Date.now() - 172800000).toISOString(), messages: [{ id: "p5", role: "user", content: "Show me a tiny debounce helper in TypeScript.", position: 1 }, { id: "p6", role: "assistant", content: "A debounce helper delays a call until input has settled.\n\n## Example\n\n```ts\nexport function debounce<T extends unknown[]>(fn: (...args: T) => void, wait = 250) {\n  let timer: ReturnType<typeof setTimeout> | undefined;\n  return (...args: T) => {\n    clearTimeout(timer);\n    timer = setTimeout(() => fn(...args), wait);\n  };\n}\n```\n\n- Use `wait` to tune responsiveness.\n- Read more in the [MDN guide](https://developer.mozilla.org/docs/Glossary/Debounce).", position: 2 }] },
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
  const conversationParam = useSearchParams().get("conversation");
  const conversations = preview ? mockConversations : (initialData?.conversations ?? []);
  const [localMessages, setLocalMessages] = useState<Record<string, PersistedMessage[]>>({});
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [localConversations, setLocalConversations] = useState<ConversationSummary[]>([]);
  const [previewActiveId, setPreviewActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState<ChatModel>((conversations.find((item) => item.id === initialData?.activeId)?.selected_model as ChatModel) ?? "Balanced");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const busy = useRef(false);
  const submission = useRef<{ id: string; content: string; conversationId: string | null } | null>(null);
  const streamController = useRef<AbortController | null>(null);
  const [serverData, setServerData] = useState(initialData);
  const [notice, setNotice] = useState(initialData?.error ?? "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeMenuRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const shownConversations = [...new Map([...conversations, ...localConversations].map((item) => [item.id, item])).values()]
    .sort((left, right) => right.updated_at.localeCompare(left.updated_at) || left.id.localeCompare(right.id));
  const activeId = preview ? previewActiveId : shownConversations.some((item) => item.id === conversationParam) ? conversationParam : null;
  const activeConversation = shownConversations.find((item) => item.id === activeId);
  const savedMessages = activeId === initialData?.activeId ? initialData.messages : [];
  const messages = preview ? [...((activeConversation as Conversation | undefined)?.messages ?? []), ...(localMessages[activeId ?? ""] ?? [])] : [...new Map([...savedMessages, ...(localMessages[activeId ?? ""] ?? [])].map((message) => [message.id, message])).values()].filter((message) => !removedIds.includes(message.id)).sort((left, right) => left.position - right.position);
  const lastMessage = messages[messages.length - 1];
  const lastUser = [...messages].reverse().find((message) => message.role === "user");
  const controlsDisabled = sending || streaming;

  if (!preview && initialData !== serverData && initialData?.activeId === activeId && !sending && !streaming) {
    const pending = localMessages[initialData?.activeId ?? ""] ?? [];
    const settled = pending.every((message) => initialData?.messages.some((saved) => saved.id === message.id && saved.status !== "streaming" && (message.role !== "user" || saved.content === message.content)));
    if (settled && removedIds.every((id) => !initialData?.messages.some((saved) => saved.id === id))) {
      setServerData(initialData);
      setMode((initialData?.conversations.find((item) => item.id === initialData.activeId)?.selected_model as ChatModel) ?? "Balanced");
      setLocalMessages({});
      setRemovedIds([]);
      setLocalConversations([]);
      if (initialData?.error) setNotice(initialData.error);
    }
  }

  useEffect(() => () => streamController.current?.abort(), []);

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
    if (busy.current && !streamController.current) return;
    streamController.current?.abort();
    if (preview) setPreviewActiveId(id);
    setNotice(""); setDrawerOpen(false); setEditing(null);
    const item = shownConversations.find((conversation) => conversation.id === id);
    if (item) setMode((item.selected_model as ChatModel) ?? "Balanced");
    if (!preview) router.push(id ? `/?conversation=${encodeURIComponent(id)}` : "/");
    requestAnimationFrame(() => menuButtonRef.current?.focus());
  }
  async function newChat() {
    if (busy.current) return;
    setNotice(""); setDraft(""); setDrawerOpen(false); setEditing(null);
    if (preview) { openConversation(null); return; }
    busy.current = true; setSending(true);
    let createdId: string | null = null;
    try {
      const result = await createConversationAction(mode);
      if (result.error || !result.data) { setNotice(result.error ?? "Conversation couldn't be created."); return; }
      createdId = result.data.id;
      setLocalConversations((items) => [result.data!, ...items]);
      setLocalMessages((items) => ({ ...items, [result.data!.id]: [] }));
    } catch { setNotice("Conversation couldn't be created."); }
    finally { busy.current = false; setSending(false); }
    if (createdId) openConversation(createdId);
  }
  // Streams one assistant response for a saved user message. The caller owns the busy guard, which is released here.
  async function generate(id: string, userMessageId: string, options: GenerateOptions = {}) {
    const controller = new AbortController();
    let assistantId: string | null = null;
    setSending(false); setStreaming(true);
    streamController.current = controller;
    try {
      const response = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ conversationId: id, userMessageId, ...(options.regenerate ? { regenerate: true } : {}) }), signal: controller.signal });
      if (!response.ok || !response.body) { const payload = await response.json().catch(() => null); throw new Error(payload?.error ?? "Nibie couldn't complete that response. Please try again."); }
      for await (const data of readChatSse(response.body)) {
        if (data.type === "start") {
          assistantId = data.id;
          // The server has replaced the previous reply once it announces the new one, so hide the old row only now.
          if (options.replaceIds?.length) setRemovedIds((ids) => [...ids, ...options.replaceIds!]);
          setLocalMessages((items) => ({ ...items, [id]: [...(items[id] ?? []), { id: data.id, role: "assistant", content: "", position: data.position, status: "streaming" }] }));
        }
        if (data.type === "delta") setLocalMessages((items) => ({ ...items, [id]: (items[id] ?? []).map((message) => message.id === assistantId ? { ...message, content: message.content + data.text } : message) }));
        if (data.type === "status") setLocalMessages((items) => ({ ...items, [id]: (items[id] ?? []).map((message) => message.id === assistantId ? { ...message, content: message.content || "Response stopped.", status: data.status } : message) }));
      }
      router.refresh();
    } catch {
      const interrupted = controller.signal.aborted;
      if (assistantId) setLocalMessages((items) => ({ ...items, [id]: (items[id] ?? []).map((message) => message.id === assistantId ? { ...message, content: message.content || (interrupted ? "Response stopped." : "Response unavailable."), status: interrupted ? "interrupted" : "error" } : message) }));
      if (!interrupted) setNotice("Nibie couldn't complete that response. Please try again.");
      router.refresh();
    } finally { streamController.current = null; busy.current = false; setSending(false); setStreaming(false); }
  }
  async function submitMessage(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const content = draft.trim();
    if (!content || busy.current) return;
    busy.current = true;
    setSending(true); setNotice(""); setEditing(null);
    let id = activeId;
    try {
      if (preview) {
        const id = activeId ?? `preview-local-${crypto.randomUUID()}`;
        const item = activeConversation ?? { id, title: content.slice(0, 42), selected_model: mode, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
        const row: PersistedMessage = { id: `local-${crypto.randomUUID()}`, role: "user", content, position: messages.length + 1 };
        if (!activeConversation) setLocalConversations((items) => [item, ...items]);
        setLocalMessages((items) => ({ ...items, [id]: [...(items[id] ?? []), row] }));
        setPreviewActiveId(id); setDraft(""); setNotice("Your message is shown in this local preview. Replies are not connected yet.");
        return;
      }
      if (!id) {
        const created = await createConversationAction(mode);
        if (created.error || !created.data) { setNotice(created.error ?? "Conversation couldn't be created."); return; }
        id = created.data.id;
        setLocalConversations((items) => [created.data!, ...items]);
        setLocalMessages((items) => ({ ...items, [id!]: [] }));
        router.push(`/?conversation=${encodeURIComponent(id)}`);
      }
      if (!submission.current || submission.current.content !== content || submission.current.conversationId !== id) submission.current = { id: crypto.randomUUID(), content, conversationId: id };
      const result = await addUserMessageAction(id, content, submission.current.id);
      if (result.error || !result.data) { setNotice(result.error ?? "Message couldn't be saved."); return; }
      submission.current = null;
      setLocalMessages((items) => ({ ...items, [id!]: [{ id: result.data!.id, role: "user", content, position: result.data!.position, status: "complete" }] }));
      setLocalConversations((items) => items.map((item) => item.id === id ? { ...item, title: item.title === "New chat" ? content.slice(0, 42) + (content.length > 42 ? "…" : "") : item.title, updated_at: new Date().toISOString() } : item));
      setDraft("");
      await generate(id, result.data.id);
    } catch {
      setNotice("Nibie couldn't complete that response. Please try again.");
      if (!preview) router.refresh();
    } finally { busy.current = false; setSending(false); }
  }
  // Last-turn controls: only the latest user message can be edited, and only its reply can be regenerated.
  function repliesAfter(message: PersistedMessage) { return messages.filter((item) => item.role === "assistant" && item.position > message.position).map((item) => item.id); }
  async function regenerate() {
    if (preview || busy.current || !activeId || !lastUser) return;
    busy.current = true; setSending(true); setNotice(""); setEditing(null);
    try { await generate(activeId, lastUser.id, { regenerate: true, replaceIds: repliesAfter(lastUser) }); }
    finally { busy.current = false; setSending(false); }
  }
  async function saveEdit() {
    if (preview || busy.current || !editing || !activeId || !lastUser || lastUser.id !== editing.id) return;
    const content = editing.text.trim();
    if (!content || content === lastUser.content) return;
    const id = activeId; const target = lastUser; const replaceIds = repliesAfter(target);
    busy.current = true; setSending(true); setNotice("");
    try {
      const result = await editLastUserMessageAction(id, target.id, content);
      if (result.error || !result.data) { setNotice(result.error ?? "Your edit couldn't be saved."); return; }
      setEditing(null);
      setRemovedIds((ids) => [...ids, ...replaceIds]);
      setLocalMessages((items) => ({ ...items, [id]: [{ id: target.id, role: "user", content, position: target.position, status: "complete" }] }));
      await generate(id, target.id);
    } catch {
      setNotice("Nibie couldn't complete that response. Please try again.");
      router.refresh();
    } finally { busy.current = false; setSending(false); }
  }
  async function changeMode(value: string) {
    if (busy.current) return;
    const previous = mode;
    const next = value as ChatModel; setMode(next);
    busy.current = true; setSending(true);
    try {
      if (activeId && !preview) {
        const result = await updateConversationModelAction(activeId, next);
        if (result.error) { setMode(previous); setNotice(result.error); }
      }
    } catch { setMode(previous); setNotice("Response mode couldn't be saved."); }
    finally { busy.current = false; setSending(false); }
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
    if (busy.current && item.id === activeId) return;
    if (preview || !window.confirm(`Delete “${item.title}”?`)) return;
    const result = await deleteConversationAction(item.id);
    if (result.error) { setNotice(result.error); return; }
    setLocalConversations((items) => items.filter((entry) => entry.id !== item.id));
    setLocalMessages((items) => { const next = { ...items }; delete next[item.id]; return next; });
    if (activeId === item.id) openConversation(null);
    router.refresh();
  }
  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void submitMessage(); } }
  function handleEditKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Escape") { event.preventDefault(); setEditing(null); }
    else if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) { event.preventDefault(); void saveEdit(); }
  }

  function renderMessage(message: PersistedMessage) {
    const isLast = message.id === lastMessage?.id;
    if (message.role === "assistant") {
      const canCopy = message.status !== "streaming" && message.status !== "error" && Boolean(message.content) && !placeholderResponses.has(message.content);
      const canRegenerate = !preview && isLast && message.status !== "streaming";
      return <div className={`message-content assistant`}>
        <div className="message-author">Nibie{message.status === "streaming" ? " · Thinking" : message.status === "interrupted" ? " · Stopped" : message.status === "error" ? " · Couldn't respond" : ""}</div>
        <MessageMarkdown content={message.content} />
        {(canCopy || canRegenerate) && <div className="message-actions">
          {canCopy && <CopyButton text={message.content} label="Copy response" />}
          {canRegenerate && <button type="button" className="message-action" disabled={controlsDisabled} onClick={() => void regenerate()}><RefreshCw size={13} aria-hidden="true" /><span>{message.status === "complete" ? "Regenerate" : "Retry"}</span></button>}
        </div>}
      </div>;
    }
    const isLastUser = message.id === lastUser?.id;
    if (editing?.id === message.id) {
      const unchanged = !editing.text.trim() || editing.text.trim() === message.content;
      return <div className="message-column user"><div className="message-editor">
        <textarea aria-label="Edit message" autoFocus rows={3} maxLength={20_000} value={editing.text} onChange={(event) => setEditing({ id: message.id, text: event.target.value })} onKeyDown={handleEditKeyDown} />
        <div className="message-editor-actions"><button type="button" className="message-action" onClick={() => setEditing(null)}>Cancel</button><button type="button" className="message-action is-primary" disabled={controlsDisabled || unchanged} onClick={() => void saveEdit()}>Save &amp; resend</button></div>
      </div></div>;
    }
    return <div className="message-column user">
      <div className="message-content user"><p>{message.content}</p></div>
      {!preview && isLastUser && <div className="message-actions">
        <button type="button" className="message-action" disabled={controlsDisabled} onClick={() => setEditing({ id: message.id, text: message.content })}><Pencil size={13} aria-hidden="true" /><span>Edit</span></button>
        {isLast && <button type="button" className="message-action" disabled={controlsDisabled} onClick={() => void regenerate()}><RefreshCw size={13} aria-hidden="true" /><span>Retry</span></button>}
      </div>}
    </div>;
  }

  const groups = ["Today", "Yesterday", "Older"] as const;
  const sidebar = (mobile = false) => <aside ref={mobile ? drawerRef : undefined} className={mobile ? "workspace-sidebar mobile-sidebar" : "workspace-sidebar desktop-sidebar"} aria-label={mobile ? "Conversation menu" : "Conversation history"} role={mobile ? "dialog" : undefined} aria-modal={mobile ? true : undefined}>
    <div className="sidebar-top"><Link href="/" className="brand-lockup" aria-label="Nibie home"><span className="brand-mark">n</span><span>nibie</span></Link>{mobile && <button ref={closeMenuRef} className="icon-button" aria-label="Close menu" onClick={() => { setDrawerOpen(false); menuButtonRef.current?.focus(); }}><X size={19} /></button>}</div>
    <button className="new-chat-button" disabled={sending || streaming} onClick={() => void newChat()}><Plus size={17} strokeWidth={2.2} /> <span>New chat</span></button>
    <nav className="history-nav" aria-label="Conversations">{groups.map((group) => { const entries = shownConversations.filter((item) => groupFor(item.updated_at) === group); if (!entries.length) return null; return <section className="history-group" key={group} aria-label={group}><h2>{group}</h2>{entries.map((item) => <div className="history-entry" key={item.id}><button className={`history-item ${activeId === item.id ? "is-active" : ""}`} onClick={() => openConversation(item.id)} title={item.title}><MessageSquare size={15} /><span>{item.title}</span></button>{!preview && <><button className="history-action" aria-label={`Rename ${item.title}`} onClick={() => void rename(item)}><Pencil size={13} /></button><button className="history-action" aria-label={`Delete ${item.title}`} disabled={item.id === activeId && (sending || streaming)} onClick={() => void remove(item)}><Trash2 size={13} /></button></>}</div>)}</section>; })}</nav>
    <div className="account-area"><div className="account-card"><div className="avatar">{email.slice(0, 1).toUpperCase()}</div><span className="account-email" title={email}>{email}</span><ChevronDown size={15} /></div><form action={signOutAction}><button className="signout-button" type="submit">Sign out</button></form></div>
  </aside>;

  return <main className="chat-workspace">{sidebar()}{drawerOpen && <div className="mobile-drawer"><button className="drawer-scrim" aria-label="Dismiss menu backdrop" onClick={() => { setDrawerOpen(false); menuButtonRef.current?.focus(); }} />{sidebar(true)}</div>}
    <section className="chat-main" aria-label="Chat workspace"><header className="chat-header"><button ref={menuButtonRef} className="icon-button mobile-menu-button" aria-label="Open conversation menu" onClick={() => setDrawerOpen(true)}><Menu size={21} /></button><div className="header-model"><span className="model-dot" /><span>Nibie</span><span className="header-divider">/</span><span className="header-context">A little room to think</span></div><button className="header-new-chat" disabled={sending || streaming} onClick={() => void newChat()}><Plus size={16} /><span>New chat</span></button></header>
      <div className={`conversation-scroll ${messages.length ? "has-messages" : "is-empty"}`}>{messages.length ? <div className="message-list" aria-live="polite">{messages.map((message) => <article className={`message-row ${message.role}`} key={message.id}>{renderMessage(message)}{message.role === "user" && <div className="user-avatar" aria-label="You">{email.slice(0, 1).toUpperCase()}</div>}</article>)}{notice && <p className="local-notice" role="status">{notice}</p>}</div> : <div className="welcome-panel">{notice && <p className="local-notice" role="status">{notice}</p>}<div className="welcome-icon"><Sparkles size={19} strokeWidth={1.7} /></div><p className="welcome-eyebrow">A LITTLE ROOM TO THINK</p><h1>What’s on your mind?</h1><p className="welcome-copy">A fresh page for ideas, questions, and whatever you’re working through.</p><div className="suggestion-list" aria-label="Suggestions">{suggestions.map((suggestion) => <button key={suggestion} onClick={() => { setDraft(suggestion); textareaRef.current?.focus(); }}>{suggestion}<span>↗</span></button>)}</div></div>}</div>
      <div className="composer-dock"><form className="composer" onSubmit={(event) => void submitMessage(event)}><textarea ref={textareaRef} aria-label="Message Nibie" placeholder="Message Nibie…" value={draft} rows={1} onChange={(event) => setDraft(event.target.value)} onKeyDown={handleKeyDown} /><div className="composer-tools"><div className="composer-left-tools"><button className="composer-icon" type="button" aria-label="Attach a file" title="Attachments are not available" onClick={() => setNotice("Attachments are not available yet.")}><FilePlus2 size={18} /></button><label className="mode-select-label" htmlFor="response-mode">Response mode</label><select id="response-mode" aria-label="Response mode" disabled={sending || streaming} value={mode} onChange={(event) => void changeMode(event.target.value)}><option>Fast</option><option>Balanced</option><option>Reasoning</option></select><ChevronDown className="select-chevron" size={13} aria-hidden="true" /></div>{streaming ? <button className="send-button" type="button" aria-label="Stop response" onClick={() => streamController.current?.abort()}><X size={18} /></button> : <button className="send-button" type="submit" aria-label="Send message" disabled={!draft.trim() || sending}>{sending ? <span className="send-spinner" /> : <ArrowUp size={18} strokeWidth={2.3} />}</button>}</div></form><p className="composer-caption" role="status">{preview ? "Mock workspace · Messages stay in this tab and are not saved." : streaming ? "Nibie is responding · You can stop at any time." : "Your conversations are saved to your account."}</p></div>
    </section></main>;
}
