"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Menu, Plus } from "lucide-react";
import { addUserMessageAction, createConversationAction, deleteConversationAction, editLastUserMessageAction, renameConversationAction, updateConversationModelAction } from "@/app/actions/chat";
import { BrandMark } from "@/components/brand";
import { ChatComposer, type ComposerHandle } from "@/components/chat-composer";
import { ChatSidebar } from "@/components/chat-sidebar";
import { MessageRow } from "@/components/message-row";
import { useReasoningPreference } from "@/components/use-reasoning-preference";
import { useStableCallback } from "@/components/use-stable-callback";
import type { ConversationSummary, PersistedMessage } from "@/lib/chat/read";
import type { ChatModel } from "@/lib/chat/validation";
import { resolveMode, type ModelOption } from "@/lib/chat/models";
import { readChatSse } from "@/lib/ai/sse";
import { classifyStreamFailure, isRecoverySettled, latestReplyFailed, needsServerCheck, recoveryMaxPolls, recoveryPollMs } from "@/lib/chat/recovery";

type Conversation = ConversationSummary & { messages: PersistedMessage[] };
type WorkspaceData = { conversations: ConversationSummary[]; messages: PersistedMessage[]; activeId: string | null; error: string | null };
type GenerateOptions = { regenerate?: boolean; replaceIds?: string[]; placeholderId?: string };
// While a response's outcome is unknown, the server is polled until it reports a settled state (see lib/chat/recovery.ts).
type Recovery = { conversationId: string; assistantId: string | null; baseline: WorkspaceData | undefined };
const failureNotice = "Nibie couldn't complete that response. Please try again.";
const suggestions = ["Help me think through an idea", "Write something with me", "Explain a new topic"];
const noConversations: ConversationSummary[] = [];
// Streamed text is applied in small batches so a long reply is not re-parsed as Markdown for every network chunk.
const streamFlushMs = 80;
const mockConversations: Conversation[] = [
  { id: "preview-writing", title: "A thoughtful note to the team", selected_model: "Balanced", created_at: new Date().toISOString(), updated_at: new Date().toISOString(), messages: [{ id: "p1", role: "user", content: "Help me write a thoughtful note to my team after a busy launch week.", position: 1 }, { id: "p2", role: "assistant", content: "A good note can recognize the effort, name what the team accomplished, and leave room for everyone to recharge.\n\nYou might start with what you noticed most: the care people brought to the final details, the way they supported one another, or a moment that made you proud.", position: 2 }] },
  { id: "preview-learning", title: "Learning the basics of astronomy", selected_model: "Balanced", created_at: new Date(Date.now() - 86400000).toISOString(), updated_at: new Date(Date.now() - 86400000).toISOString(), messages: [{ id: "p3", role: "user", content: "Where should I begin if I want to learn astronomy?", position: 1 }, { id: "p4", role: "assistant", content: "Start by looking up. Learning a few bright constellations and the phases of the Moon gives you a useful map. From there, the scale of the solar system becomes much easier to picture.", position: 2 }] },
  { id: "preview-code", title: "Debouncing a search box", selected_model: "Balanced", created_at: new Date(Date.now() - 172800000).toISOString(), updated_at: new Date(Date.now() - 172800000).toISOString(), messages: [{ id: "p5", role: "user", content: "Show me a tiny debounce helper in TypeScript.", position: 1 }, { id: "p6", role: "assistant", content: "A debounce helper delays a call until input has settled.\n\n## Example\n\n```ts\nexport function debounce<T extends unknown[]>(fn: (...args: T) => void, wait = 250) {\n  let timer: ReturnType<typeof setTimeout> | undefined;\n  return (...args: T) => {\n    clearTimeout(timer);\n    timer = setTimeout(() => fn(...args), wait);\n  };\n}\n```\n\n- Use `wait` to tune responsiveness.\n- Read more in the [MDN guide](https://developer.mozilla.org/docs/Glossary/Debounce).", position: 2 }] },
];

const noModels: ModelOption[] = [];
const noReasoningModes: ChatModel[] = [];

export function ChatWorkspace({ email, initialData, preview = false, models = noModels, reasoningModes = noReasoningModes }: { email: string; initialData?: WorkspaceData; preview?: boolean; models?: ModelOption[]; reasoningModes?: ChatModel[] }) {
  const router = useRouter();
  const conversationParam = useSearchParams().get("conversation");
  const conversations = preview ? mockConversations : (initialData?.conversations ?? noConversations);
  const [localMessages, setLocalMessages] = useState<Record<string, PersistedMessage[]>>({});
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [recovery, setRecovery] = useState<Recovery | null>(null);
  const [localConversations, setLocalConversations] = useState<ConversationSummary[]>([]);
  const [previewActiveId, setPreviewActiveId] = useState<string | null>(null);
  // The conversation the user just chose, applied immediately while the server renders it. undefined = follow the URL.
  const [pendingId, setPendingId] = useState<string | null | undefined>(undefined);
  // A conversation's saved mode is only used while that mode is still configured; otherwise the first available one is shown.
  const availableModes = useMemo(() => models.map((option) => option.id), [models]);
  const modeFor = (saved: string | undefined) => resolveMode(saved, availableModes) ?? "Balanced";
  const [mode, setMode] = useState<ChatModel>(() => modeFor(conversations.find((item) => item.id === initialData?.activeId)?.selected_model));
  const [reasoning, setReasoning] = useReasoningPreference();
  // Reasoning effort is only sent for modes the server has verified; everywhere else it is Auto (nothing is sent).
  const requestReasoning = reasoningModes.includes(mode) ? reasoning : "auto";
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const busy = useRef(false);
  const submission = useRef<{ id: string; content: string; conversationId: string | null } | null>(null);
  const streamController = useRef<AbortController | null>(null);
  const [serverData, setServerData] = useState(initialData);
  const [notice, setNotice] = useState(initialData?.error ?? "");
  const composerRef = useRef<ComposerHandle>(null);
  const latestData = useRef(initialData);
  useLayoutEffect(() => { latestData.current = initialData; });
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeMenuRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const shownConversations = useMemo(() => [...new Map([...conversations, ...localConversations].map((item) => [item.id, item])).values()]
    .sort((left, right) => right.updated_at.localeCompare(left.updated_at) || left.id.localeCompare(right.id)), [conversations, localConversations]);
  const paramActiveId = shownConversations.some((item) => item.id === conversationParam) ? conversationParam : null;
  const activeId = preview ? previewActiveId : pendingId !== undefined ? pendingId : paramActiveId;
  const activeConversation = shownConversations.find((item) => item.id === activeId);
  const savedMessages = activeId === initialData?.activeId ? initialData?.messages : undefined;
  const activeLocal = localMessages[activeId ?? ""];
  const messages = useMemo(() => preview
    ? [...((activeConversation as Conversation | undefined)?.messages ?? []), ...(activeLocal ?? [])]
    : [...new Map([...(savedMessages ?? []), ...(activeLocal ?? [])].map((message) => [message.id, message])).values()].filter((message) => !removedIds.includes(message.id)).sort((left, right) => left.position - right.position),
  [preview, activeConversation, activeLocal, savedMessages, removedIds]);
  const loadingConversation = !preview && pendingId != null && initialData?.activeId !== pendingId && !activeLocal?.length;
  const lastMessage = messages[messages.length - 1];
  const lastUser = useMemo(() => [...messages].reverse().find((message) => message.role === "user"), [messages]);
  const recovering = recovery !== null;
  const controlsDisabled = sending || streaming;
  // Message actions stay locked until the server confirms how the last response ended, so they cannot collide with it.
  const messageActionsLocked = controlsDisabled || recovering;
  const initial = email.slice(0, 1).toUpperCase();

  // The navigation the user asked for has landed once the URL matches it; from then on the URL is the source of truth again.
  if (pendingId !== undefined && conversationParam === pendingId) setPendingId(undefined);

  if (recovery && initialData && initialData !== recovery.baseline && initialData.activeId === recovery.conversationId && isRecoverySettled(initialData.messages, recovery.assistantId)) {
    // Fresh server data says the response is settled: show the server's truth and drop any stale failure notice.
    setRecovery(null);
    setNotice(latestReplyFailed(initialData.messages) ? failureNotice : "");
  }

  if (!preview && initialData !== serverData && initialData?.activeId === activeId && !sending && !streaming) {
    const pending = localMessages[initialData?.activeId ?? ""] ?? [];
    const settled = pending.every((message) => initialData?.messages.some((saved) => saved.id === message.id && saved.status !== "streaming" && (message.role !== "user" || saved.content === message.content)));
    if (settled && removedIds.every((id) => !initialData?.messages.some((saved) => saved.id === id))) {
      setServerData(initialData);
      setMode(modeFor(initialData?.conversations.find((item) => item.id === initialData.activeId)?.selected_model));
      setLocalMessages({});
      setRemovedIds([]);
      setLocalConversations([]);
      if (initialData?.error) setNotice(initialData.error);
    }
  }

  useEffect(() => () => streamController.current?.abort(), []);
  const recoveryConversationId = recovery?.conversationId ?? null;
  useEffect(() => {
    if (!recoveryConversationId) return;
    let polls = 0;
    router.refresh();
    const timer = setInterval(() => {
      polls += 1;
      if (polls >= recoveryMaxPolls) { clearInterval(timer); setRecovery(null); setNotice("We couldn't confirm that response. Reload the page to check it."); return; }
      router.refresh();
    }, recoveryPollMs);
    return () => clearInterval(timer);
  }, [recoveryConversationId, router]);
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

  const openConversation = useStableCallback((id: string | null) => {
    if (busy.current && !streamController.current) return;
    streamController.current?.abort();
    setNotice(""); setDrawerOpen(false); setEditingId(null); setRecovery(null);
    const item = shownConversations.find((conversation) => conversation.id === id);
    if (item) setMode(modeFor(item.selected_model));
    if (preview) setPreviewActiveId(id);
    else { setPendingId(id); router.push(id ? `/?conversation=${encodeURIComponent(id)}` : "/"); }
    requestAnimationFrame(() => menuButtonRef.current?.focus());
  });
  // New chat opens the empty conversation immediately. The conversation row is created with the first message, so there is no
  // server work (and no empty "New chat" entries left in history) until the user actually sends something.
  const newChat = useStableCallback(() => {
    if (busy.current) return;
    composerRef.current?.clear();
    openConversation(null);
  });

  // Streams one assistant response for a saved user message. The caller owns the busy guard, which is released here.
  async function generate(id: string, userMessageId: string, options: GenerateOptions = {}) {
    const controller = new AbortController();
    let assistantId: string | null = null;
    let httpStatus: number | undefined;
    let buffer = "";
    let flushTimer: ReturnType<typeof setTimeout> | null = null;
    let shown = false;
    const flush = () => {
      if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
      if (!buffer || !assistantId) return;
      const text = buffer; const target = assistantId; buffer = ""; shown = true;
      setLocalMessages((items) => ({ ...items, [id]: (items[id] ?? []).map((message) => message.id === target ? { ...message, content: message.content + text } : message) }));
    };
    const clearPlaceholder = () => { if (options.placeholderId) setLocalMessages((items) => items[id]?.some((row) => row.id === options.placeholderId) ? { ...items, [id]: items[id].filter((row) => row.id !== options.placeholderId) } : items); };
    setSending(false); setStreaming(true);
    streamController.current = controller;
    try {
      const response = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ conversationId: id, userMessageId, model: mode, ...(requestReasoning !== "auto" ? { reasoning: requestReasoning } : {}), ...(options.regenerate ? { regenerate: true } : {}) }), signal: controller.signal });
      if (!response.ok || !response.body) { if (!response.ok) httpStatus = response.status; const payload = await response.json().catch(() => null); throw new Error(payload?.error ?? failureNotice); }
      for await (const data of readChatSse(response.body)) {
        if (data.type === "start") {
          assistantId = data.id;
          // The server has replaced the previous reply once it announces the new one, so hide the old row only now.
          if (options.replaceIds?.length) setRemovedIds((ids) => [...ids, ...options.replaceIds!]);
          const reply: PersistedMessage = { id: data.id, role: "assistant", content: "", position: data.position, status: "streaming" };
          setLocalMessages((items) => { const rows = items[id] ?? []; return { ...items, [id]: options.placeholderId && rows.some((row) => row.id === options.placeholderId) ? rows.map((row) => row.id === options.placeholderId ? reply : row) : [...rows, reply] }; });
        }
        if (data.type === "delta") { buffer += data.text; if (!shown) flush(); else if (!flushTimer) flushTimer = setTimeout(flush, streamFlushMs); }
        if (data.type === "status") { flush(); setLocalMessages((items) => ({ ...items, [id]: (items[id] ?? []).map((message) => message.id === assistantId ? { ...message, content: message.content || "Response stopped.", status: data.status } : message) })); }
      }
      flush();
      router.refresh();
    } catch (error) {
      flush();
      const kind = classifyStreamFailure({ error, aborted: controller.signal.aborted, httpStatus });
      if (!assistantId) clearPlaceholder();
      if (needsServerCheck(kind)) {
        // The outcome is not known from this side: the server saves the terminal state of every generation, so keep what is
        // on screen, lock message actions, and let the polling effect adopt the server's final state.
        if (assistantId && kind === "stopped") setLocalMessages((items) => ({ ...items, [id]: (items[id] ?? []).map((message) => message.id === assistantId ? { ...message, content: message.content || "Response stopped.", status: "interrupted" } : message) }));
        setNotice(kind === "lost-connection" ? "The connection dropped. Checking whether your response was saved…" : kind === "in-progress" ? "A response is still finishing. It will appear here when it's done." : "");
        setRecovery({ conversationId: id, assistantId, baseline: latestData.current });
      } else {
        // The server reported this failure itself, so it is final.
        if (assistantId) setLocalMessages((items) => ({ ...items, [id]: (items[id] ?? []).map((message) => message.id === assistantId ? { ...message, content: message.content || "Response unavailable.", status: "error" } : message) }));
        setNotice(failureNotice);
        router.refresh();
      }
    } finally { clearPlaceholder(); if (flushTimer) clearTimeout(flushTimer); streamController.current = null; busy.current = false; setSending(false); setStreaming(false); }
  }
  const submitMessage = useStableCallback(async (content: string) => {
    if (!content || busy.current || recovery) return;
    busy.current = true;
    setSending(true); setNotice(""); setEditingId(null);
    let id = activeId;
    try {
      if (preview) {
        const id = activeId ?? `preview-local-${crypto.randomUUID()}`;
        const item = activeConversation ?? { id, title: content.slice(0, 42), selected_model: mode, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
        const row: PersistedMessage = { id: `local-${crypto.randomUUID()}`, role: "user", content, position: messages.length + 1 };
        if (!activeConversation) setLocalConversations((items) => [item, ...items]);
        setLocalMessages((items) => ({ ...items, [id]: [...(items[id] ?? []), row] }));
        setPreviewActiveId(id); composerRef.current?.clear(); setNotice("Your message is shown in this local preview. Replies are not connected yet.");
        return;
      }
      // The same submission keeps the same message id, so a retry after a failure can never save the message twice.
      const messageId = submission.current && submission.current.content === content && submission.current.conversationId === id ? submission.current.id : crypto.randomUUID();
      submission.current = { id: messageId, content, conversationId: id };
      const placeholderId = `pending-${messageId}`;
      const basePosition = lastMessage?.position ?? 0;
      const withoutPending = (rows: PersistedMessage[] = []) => rows.filter((row) => row.id !== messageId && row.id !== placeholderId);
      // Show the message and a thinking row immediately; the server confirms (or we roll back and restore the draft) below.
      const key = id ?? "";
      setLocalMessages((items) => ({ ...items, [key]: [...withoutPending(items[key]), { id: messageId, role: "user", content, position: basePosition + 1, status: "complete" }, { id: placeholderId, role: "assistant", content: "", position: basePosition + 2, status: "streaming" }] }));
      composerRef.current?.clear();
      const rollback = (message: string, from: string) => { setLocalMessages((items) => ({ ...items, [from]: withoutPending(items[from]) })); composerRef.current?.restore(content); setNotice(message); };
      if (!id) {
        const created = await createConversationAction(mode);
        if (created.error || !created.data) { rollback(created.error ?? "Conversation couldn't be created.", key); return; }
        id = created.data.id;
        submission.current = { id: messageId, content, conversationId: id };
        setLocalConversations((items) => [created.data!, ...items]);
        setLocalMessages((items) => { const { "": rows = [], ...rest } = items; return { ...rest, [id!]: rows }; });
        setPendingId(id);
        router.push(`/?conversation=${encodeURIComponent(id)}`);
      }
      const result = await addUserMessageAction(id, content, messageId);
      if (result.error || !result.data) { rollback(result.error ?? "Message couldn't be saved.", id); return; }
      submission.current = null;
      const saved = result.data;
      setLocalMessages((items) => ({ ...items, [id!]: (items[id!] ?? []).map((row) => row.id === messageId ? { ...row, position: saved.position } : row.id === placeholderId ? { ...row, position: saved.position + 1 } : row) }));
      setLocalConversations((items) => items.map((item) => item.id === id ? { ...item, title: item.title === "New chat" ? content.slice(0, 42) + (content.length > 42 ? "…" : "") : item.title, updated_at: new Date().toISOString() } : item));
      await generate(id, messageId, { placeholderId });
    } catch {
      setNotice("Nibie couldn't complete that response. Please try again.");
      if (!preview) router.refresh();
    } finally { busy.current = false; setSending(false); }
  });

  // Last-turn controls: only the latest user message can be edited, and only its reply can be regenerated.
  function repliesAfter(message: PersistedMessage) { return messages.filter((item) => item.role === "assistant" && item.position > message.position).map((item) => item.id); }
  const regenerate = useStableCallback(async () => {
    if (preview || busy.current || recovery || !activeId || !lastUser) return;
    busy.current = true; setSending(true); setNotice(""); setEditingId(null);
    try { await generate(activeId, lastUser.id, { regenerate: true, replaceIds: repliesAfter(lastUser) }); }
    finally { busy.current = false; setSending(false); }
  });
  const saveEdit = useStableCallback(async (messageId: string, content: string) => {
    if (preview || busy.current || recovery || !activeId || !lastUser || lastUser.id !== messageId || !content || content === lastUser.content) return;
    const id = activeId; const target = lastUser; const replaceIds = repliesAfter(target);
    busy.current = true; setSending(true); setNotice("");
    try {
      const result = await editLastUserMessageAction(id, target.id, content);
      if (result.error || !result.data) { setNotice(result.error ?? "Your edit couldn't be saved."); return; }
      setEditingId(null);
      setRemovedIds((ids) => [...ids, ...replaceIds]);
      setLocalMessages((items) => ({ ...items, [id]: [{ id: target.id, role: "user", content, position: target.position, status: "complete" }] }));
      await generate(id, target.id);
    } catch {
      setNotice("Nibie couldn't complete that response. Please try again.");
      router.refresh();
    } finally { busy.current = false; setSending(false); }
  });
  // Choosing a model never blocks Send: the choice applies to the next request immediately (it is sent with it), and saving it to the
  // conversation happens in the background. A failed save puts the previous choice back.
  const changeMode = useStableCallback((next: ChatModel) => {
    if (next === mode) return;
    const previous = mode;
    setMode(next);
    if (!activeId || preview) return;
    const revert = (message: string) => { setMode((current) => current === next ? previous : current); setNotice(message); };
    updateConversationModelAction(activeId, next).then((result) => { if (result.error) revert(result.error); }, () => revert("Response mode couldn't be saved."));
  });
  const rename = useStableCallback(async (item: ConversationSummary) => {
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
  });
  const remove = useStableCallback(async (item: ConversationSummary) => {
    if (busy.current && item.id === activeId) return;
    if (preview || !window.confirm(`Delete “${item.title}”?`)) return;
    const result = await deleteConversationAction(item.id);
    if (result.error) { setNotice(result.error); return; }
    setLocalConversations((items) => items.filter((entry) => entry.id !== item.id));
    setLocalMessages((items) => { const next = { ...items }; delete next[item.id]; return next; });
    if (activeId === item.id) openConversation(null);
    router.refresh();
  });
  const closeDrawer = useStableCallback(() => { setDrawerOpen(false); menuButtonRef.current?.focus(); });
  const stopStream = useStableCallback(() => streamController.current?.abort());
  const attach = useStableCallback(() => setNotice("Attachments are not available yet."));
  const cancelEdit = useStableCallback(() => setEditingId(null));
  const startEdit = useStableCallback((id: string) => setEditingId(id));

  const history = activeId ? activeId : null;
  const caption = preview ? "Mock workspace · Messages stay in this tab and are not saved." : streaming ? "Nibie is responding · You can stop at any time." : "Your conversations are saved to your account.";
  const sidebarProps = { conversations: shownConversations, activeId: history, busy: controlsDisabled, preview, email, onClose: closeDrawer, onOpen: openConversation, onNewChat: newChat, onRename: rename, onDelete: remove };

  return <main className="chat-workspace"><ChatSidebar {...sidebarProps} />{drawerOpen && <div className="mobile-drawer"><button className="drawer-scrim" aria-label="Dismiss menu backdrop" onClick={closeDrawer} /><ChatSidebar {...sidebarProps} mobile drawerRef={drawerRef} closeMenuRef={closeMenuRef} /></div>}
    <section className="chat-main" aria-label="Chat workspace"><header className="chat-header"><button ref={menuButtonRef} className="icon-button mobile-menu-button" aria-label="Open conversation menu" onClick={() => setDrawerOpen(true)}><Menu size={21} /></button><div className="header-model"><span className="model-dot" /><span>Nibie</span><span className="header-divider">/</span><span className="header-context">A little room to think</span></div><button className="header-new-chat" disabled={controlsDisabled} onClick={newChat}><Plus size={16} /><span>New chat</span></button></header>
      <div className={`conversation-scroll ${messages.length || loadingConversation ? "has-messages" : "is-empty"}`}>{loadingConversation ? <div className="message-list conversation-skeleton" role="status" aria-busy="true" aria-label="Loading conversation"><div className="skeleton-line is-short" /><div className="skeleton-line" /><div className="skeleton-line" /><div className="skeleton-line is-medium" /></div> : messages.length ? <div className="message-list" aria-live="polite">{messages.map((message) => <MessageRow key={message.id} message={message} initial={initial} isLast={message.id === lastMessage?.id} isLastUser={message.id === lastUser?.id} canMutate={!preview} disabled={messageActionsLocked} editing={editingId === message.id} onRegenerate={regenerate} onStartEdit={startEdit} onCancelEdit={cancelEdit} onSaveEdit={saveEdit} />)}{notice && <p className="local-notice" role="status">{notice}</p>}</div> : <div className="welcome-panel">{notice && <p className="local-notice" role="status">{notice}</p>}<div className="welcome-icon"><BrandMark /></div><p className="welcome-eyebrow">A LITTLE ROOM TO THINK</p><h1>What’s on your mind?</h1><p className="welcome-copy">A fresh page for ideas, questions, and whatever you’re working through.</p><div className="suggestion-list" aria-label="Suggestions">{suggestions.map((suggestion) => <button key={suggestion} onClick={() => { composerRef.current?.set(suggestion); composerRef.current?.focus(); }}>{suggestion}<span>↗</span></button>)}</div></div>}</div>
      <ChatComposer ref={composerRef} sending={sending || recovering} streaming={streaming} models={models} mode={mode} reasoningModes={reasoningModes} reasoning={reasoning} caption={caption} onSubmit={submitMessage} onStop={stopStream} onModeChange={changeMode} onReasoningChange={setReasoning} onAttach={attach} />
    </section></main>;
}
