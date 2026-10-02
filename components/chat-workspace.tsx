"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Menu, Plus } from "lucide-react";
import { addUserMessageAction, deleteConversationAction, editLastUserMessageAction, moveConversationAction, renameConversationAction, startConversationAction, updateConversationModelAction } from "@/app/actions/chat";
import { createRoomAction, deleteRoomAction, updateRoomAction, updateRoomBriefAction } from "@/app/actions/rooms";
import { BrandMark } from "@/components/brand";
import { ChatComposer, type ComposerHandle } from "@/components/chat-composer";
import { ChatSidebar } from "@/components/chat-sidebar";
import { RoomDetail } from "@/components/room-detail";
import { RoomCreateDialog } from "@/components/room-create-dialog";
import { RoomFilePicker } from "@/components/room-file-picker";
import { SettingsDialog } from "@/components/settings/settings-dialog";
import type { SettingsSectionId } from "@/components/settings/registry";
import { MessageRow } from "@/components/message-row";
import { forgetLastConversationId, readChatFlag, readLastConversationId, subscribeChatPreferences, writeLastConversationId } from "@/components/use-chat-preferences";
import { useReasoningPreference } from "@/components/use-reasoning-preference";
import { useStableCallback } from "@/components/use-stable-callback";
import type { ConversationSummary, PersistedMessage, RoomSummary } from "@/lib/chat/read";
import type { ChatModel } from "@/lib/chat/validation";
import type { ModelOption } from "@/lib/chat/models";
import { decideRestoredConversation } from "@/lib/chat/preferences";
import { roomContextFromRows } from "@/lib/rooms/map";
import type { RoomBriefFields, RoomDraft } from "@/lib/rooms/types";
import { chatPath, conversationPath, roomDraftPath, roomPath } from "@/lib/routes";
import { clearStoredConversationReference } from "@/lib/privacy/local-state";
import { modelForComposer } from "@/lib/preferences/model";
import { accountDisplayName } from "@/lib/auth/display-name";
import { defaultUserPreferences, type UserPreferences } from "@/lib/preferences/types";
import { previewContextDiagnostics } from "@/lib/context/profile-context";
import type { ContextDiagnostics } from "@/lib/context/context-types";
import { followAfterSending, followStreamedContent, isNearBottom, trackNearBottom } from "@/lib/chat/scroll";
import { readChatSse } from "@/lib/ai/sse";
import { readRoomFileSelection, rememberRoomFileSelection } from "@/lib/files/selection-memory";
import { activeAssistantId, classifyStreamFailure, hasActiveGeneration, isRecoverySettled, isRegressiveSnapshot, latestReplyFailed, needsServerCheck, recoveryPollAction, recoveryPollMs, unseenGenerationSettled } from "@/lib/chat/recovery";

type Conversation = ConversationSummary & { messages: PersistedMessage[] };
type WorkspaceData = { conversations: ConversationSummary[]; rooms?: RoomSummary[]; messages: PersistedMessage[]; activeId: string | null; error: string | null };
type GenerateOptions = { regenerate?: boolean; replaceIds?: string[]; placeholderId?: string; fileIds?: string[] };
// While a response's outcome is unknown, the server is polled until it reports a settled state (see lib/chat/recovery.ts).
type Recovery = { conversationId: string; assistantId: string | null; baseline: WorkspaceData | undefined };
const failureNotice = "Nibie couldn't complete that response. Please try again.";
const unconfirmedNotice = "We couldn't confirm that response. Reload the page to check it.";
const stillFinishingNotice = "A response is still finishing. It will appear here when it's done.";
const checkAgainNotice = "This response is still in progress. Refresh the page to check it again.";
const droppedConnectionNotice = "The connection dropped. Checking whether your response was saved…";
const suggestions = ["Help me think through an idea", "Write something with me", "Explain a new topic"];
const noConversations: ConversationSummary[] = [];
// Streamed text is applied in small batches so a long reply is not re-parsed as Markdown for every network chunk.
const streamFlushMs = 80;
const previewStamp = "2026-10-01T08:30:00.000Z";
const previewRoomId = "preview-room-nibie";
const mockRooms: RoomSummary[] = [
  { id: previewRoomId, name: "Nibie Development", description: "The product and the context engine.", instructions: "Keep the voice calm and specific.", created_at: previewStamp, updated_at: previewStamp, brief: { goal: "Ship Rooms", current_focus: "Room detail", important_decisions: null, open_questions: null, next_step: "Keep general threads working" } },
];
const mockConversations: Conversation[] = [
  { id: "preview-writing", title: "A thoughtful note to the team", selected_model: "Balanced", room_id: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), messages: [{ id: "p1", role: "user", content: "Help me write a thoughtful note to my team after a busy launch week.", position: 1, created_at: previewStamp }, { id: "p2", role: "assistant", content: "A good note can recognize the effort, name what the team accomplished, and leave room for everyone to recharge.\n\nYou might start with what you noticed most: the care people brought to the final details, the way they supported one another, or a moment that made you proud.", position: 2, created_at: previewStamp }] },
  { id: "preview-learning", title: "Learning the basics of astronomy", selected_model: "Balanced", room_id: previewRoomId, created_at: new Date(Date.now() - 86400000).toISOString(), updated_at: new Date(Date.now() - 86400000).toISOString(), messages: [{ id: "p3", role: "user", content: "Where should I begin if I want to learn astronomy?", position: 1, created_at: previewStamp }, { id: "p4", role: "assistant", content: "Start by looking up. Learning a few bright constellations and the phases of the Moon gives you a useful map. From there, the scale of the solar system becomes much easier to picture.", position: 2, created_at: previewStamp }] },
  { id: "preview-code", title: "Debouncing a search box", selected_model: "Balanced", room_id: null, created_at: new Date(Date.now() - 172800000).toISOString(), updated_at: new Date(Date.now() - 172800000).toISOString(), messages: [{ id: "p5", role: "user", content: "Show me a tiny debounce helper in TypeScript.", position: 1, created_at: previewStamp }, { id: "p6", role: "assistant", content: "A debounce helper delays a call until input has settled.\n\n## Example\n\n```ts\nexport function debounce<T extends unknown[]>(fn: (...args: T) => void, wait = 250) {\n  let timer: ReturnType<typeof setTimeout> | undefined;\n  return (...args: T) => {\n    clearTimeout(timer);\n    timer = setTimeout(() => fn(...args), wait);\n  };\n}\n```\n\n- Use `wait` to tune responsiveness.\n- Read more in the [MDN guide](https://developer.mozilla.org/docs/Glossary/Debounce).", position: 2, created_at: previewStamp }] },
];

const noModels: ModelOption[] = [];
const noReasoningModes: ChatModel[] = [];

export function ChatWorkspace({ email, metadataName = null, initialData, preview = false, models = noModels, reasoningModes = noReasoningModes, renderedAt, preferences, preferencesError = null }: { email: string; metadataName?: string | null; initialData?: WorkspaceData; preview?: boolean; models?: ModelOption[]; reasoningModes?: ChatModel[]; renderedAt?: number; preferences?: UserPreferences; preferencesError?: string | null }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const conversationParam = searchParams.get("conversation");
  const roomParam = searchParams.get("room");
  const draftParam = searchParams.get("draft") === "1";
  // Server history captured at delete-all. It stays hidden until a newer server payload arrives, so deleted chats do not flash back.
  const [droppedServerHistory, setDroppedServerHistory] = useState<WorkspaceData | null>(null);
  const conversations = preview ? mockConversations : initialData && initialData === droppedServerHistory ? noConversations : (initialData?.conversations ?? noConversations);
  const [localMessages, setLocalMessages] = useState<Record<string, PersistedMessage[]>>({});
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [recovery, setRecovery] = useState<Recovery | null>(null);
  const [localConversations, setLocalConversations] = useState<ConversationSummary[]>([]);
  const [previewActiveId, setPreviewActiveId] = useState<string | null>(null);
  // The conversation the user just chose, applied immediately while the server renders it. undefined = follow the URL.
  const [pendingId, setPendingId] = useState<string | null | undefined>(undefined);
  const [pendingRoomId, setPendingRoomId] = useState<string | null | undefined>(undefined);
  const [pendingDraft, setPendingDraft] = useState<boolean | undefined>(undefined);
  const serverRooms = initialData?.rooms;
  const [roomListStamp, setRoomListStamp] = useState(serverRooms);
  const [roomOverrides, setRoomOverrides] = useState<Record<string, RoomSummary | null>>({});
  if (!preview && serverRooms !== roomListStamp) {
    setRoomListStamp(serverRooms);
    setRoomOverrides({});
  }
  // A conversation's saved mode is only used while that mode is still configured; otherwise the first available one is shown.
  const availableModes = useMemo(() => models.map((option) => option.id), [models]);
  const [savedPreferences, setSavedPreferences] = useState(preferences ?? defaultUserPreferences());
  const [serverUpdatedAt, setServerUpdatedAt] = useState(preferences?.updatedAt ?? null);
  if (preferences && preferences.updatedAt !== serverUpdatedAt) {
    setServerUpdatedAt(preferences.updatedAt);
    setSavedPreferences(preferences);
  }
  const pinnedNewChatMode = useRef(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [settingsSection, setSettingsSection] = useState<SettingsSectionId>("general");
  const [contextDiagnostics, setContextDiagnostics] = useState<ContextDiagnostics | null>(null);
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [filePickerOpen, setFilePickerOpen] = useState(false);
  const modeFor = (saved: string | undefined, hasConversation: boolean) => modelForComposer({
    hasConversation,
    conversationModel: saved,
    accountDefault: savedPreferences.defaultModel,
    available: availableModes,
  }) ?? "Balanced";
  const [mode, setMode] = useState<ChatModel>(() => modeFor(conversations.find((item) => item.id === initialData?.activeId)?.selected_model, Boolean(initialData?.activeId)));
  const [reasoning, setReasoning] = useReasoningPreference();
  // Reasoning effort is only sent for modes the server has verified; everywhere else it is Auto (nothing is sent).
  const requestReasoning = reasoningModes.includes(mode) ? reasoning : "auto";
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const busy = useRef(false);
  const submission = useRef<{ id: string; content: string; conversationId: string | null } | null>(null);
  const streamController = useRef<AbortController | null>(null);
  const recoveryEpoch = useRef(0);
  const [acceptedMessages, setAcceptedMessages] = useState<PersistedMessage[]>(initialData?.messages ?? []);
  const acceptedMessagesRef = useRef(acceptedMessages);
  useEffect(() => { acceptedMessagesRef.current = acceptedMessages; }, [acceptedMessages]);
  const [serverData, setServerData] = useState(initialData);
  const [notice, setNotice] = useState(initialData?.error ?? "");
  const composerRef = useRef<ComposerHandle>(null);
  const latestData = useRef(initialData);
  useLayoutEffect(() => { latestData.current = initialData; });
  // The conversation follows new content while auto-follow is on and the reader is near the bottom (see lib/chat/scroll.ts).
  const scrollRef = useRef<HTMLDivElement>(null);
  const followRef = useRef(true);
  const autoFollowRef = useRef(readChatFlag("autoFollow"));
  const pinLatestRef = useRef(true);
  const restoredRef = useRef(false);
  const handleScroll = useStableCallback(() => { if (scrollRef.current) followRef.current = trackNearBottom(autoFollowRef.current, isNearBottom(scrollRef.current)); });
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeMenuRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const shownConversations = useMemo(() => [...new Map([...conversations, ...localConversations].map((item) => [item.id, item])).values()]
    .sort((left, right) => right.updated_at.localeCompare(left.updated_at) || left.id.localeCompare(right.id)), [conversations, localConversations]);
  const rooms = useMemo(() => {
    const source = preview ? mockRooms : (serverRooms ?? []);
    const map = new Map(source.map((room) => [room.id, room]));
    for (const [id, override] of Object.entries(roomOverrides)) {
      if (override) map.set(id, override);
      else map.delete(id);
    }
    return [...map.values()].sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id));
  }, [preview, roomOverrides, serverRooms]);
  const paramActiveId = shownConversations.some((item) => item.id === conversationParam) ? conversationParam : null;
  const activeId = preview ? previewActiveId : pendingId !== undefined ? pendingId : paramActiveId;
  const paramRoomId = rooms.some((room) => room.id === roomParam) ? roomParam : null;
  const selectedRoomId = pendingRoomId !== undefined ? pendingRoomId : paramRoomId;
  const drafting = (pendingDraft !== undefined ? pendingDraft : draftParam) && Boolean(selectedRoomId) && !activeId;
  const showRoom = Boolean(selectedRoomId) && !activeId && !drafting;
  const activeRoom = rooms.find((room) => room.id === selectedRoomId) ?? null;
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
  useLayoutEffect(() => {
    const box = scrollRef.current;
    if (!box) return;
    if (pinLatestRef.current) {
      if (loadingConversation) return;
      box.scrollTop = box.scrollHeight;
      pinLatestRef.current = false;
      followRef.current = trackNearBottom(autoFollowRef.current, isNearBottom(box));
      return;
    }
    if (followStreamedContent(autoFollowRef.current, followRef.current)) box.scrollTop = box.scrollHeight;
  }, [messages, activeId, loadingConversation]);

  // The navigation the user asked for has landed once the URL matches it; from then on the URL is the source of truth again.
  if (pendingId !== undefined && conversationParam === pendingId) setPendingId(undefined);
  if (pendingRoomId !== undefined && (roomParam ?? null) === pendingRoomId) setPendingRoomId(undefined);
  if (pendingDraft !== undefined && draftParam === pendingDraft) setPendingDraft(undefined);

  const serverSnapshot = initialData && initialData.activeId === (recovery?.conversationId ?? activeId) && !isRegressiveSnapshot(acceptedMessages, initialData.messages) ? initialData : null;
  if (serverSnapshot && serverSnapshot.messages !== acceptedMessages) setAcceptedMessages(serverSnapshot.messages);
  const baselineMessages = recovery?.baseline?.messages ?? [];
  const recoverySettled = Boolean(recovery && serverSnapshot && serverSnapshot !== recovery.baseline && (recovery.assistantId ? isRecoverySettled(serverSnapshot.messages, recovery.assistantId, baselineMessages) : unseenGenerationSettled(baselineMessages, serverSnapshot.messages)));
  if (recovery && serverSnapshot && recoverySettled) {
    // Fresh server data says the response is settled: show the server's truth and drop any stale failure notice.
    setRecovery(null);
    setNotice(latestReplyFailed(serverSnapshot.messages) ? failureNotice : "");
    setServerData(serverSnapshot);
    setLocalMessages((items) => { const next = { ...items }; delete next[recovery.conversationId]; return next; });
    setRemovedIds([]);
  }

  if (!preview && serverSnapshot && serverSnapshot !== serverData && serverSnapshot.activeId === activeId && !sending && !streaming && !recoverySettled) {
    const pending = localMessages[serverSnapshot?.activeId ?? ""] ?? [];
    const settled = pending.every((message) => serverSnapshot?.messages.some((saved) => saved.id === message.id && saved.status !== "streaming" && (message.role !== "user" || saved.content === message.content)));
    if (settled && removedIds.every((id) => !serverSnapshot?.messages.some((saved) => saved.id === id))) {
      setServerData(serverSnapshot);
      // A new chat has no saved mode. Adopting the empty server payload must not wipe the choice the user just made.
      if (serverSnapshot?.activeId) setMode(modeFor(serverSnapshot.conversations.find((item) => item.id === serverSnapshot.activeId)?.selected_model, true));
      setLocalMessages({});
      setRemovedIds([]);
      setLocalConversations([]);
      if (serverSnapshot?.error) setNotice(serverSnapshot.error);
      else if (!latestReplyFailed(serverSnapshot.messages) && (notice === unconfirmedNotice || notice === stillFinishingNotice || notice === droppedConnectionNotice)) setNotice("");
    }
  }

  useEffect(() => () => streamController.current?.abort(), []);
  useEffect(() => { if (drafting) composerRef.current?.focus(); }, [drafting, selectedRoomId]);
  useEffect(() => subscribeChatPreferences(() => {
    autoFollowRef.current = readChatFlag("autoFollow");
    const box = scrollRef.current;
    followRef.current = trackNearBottom(autoFollowRef.current, box ? isNearBottom(box) : false);
  }), []);
  useEffect(() => {
    if (preview || restoredRef.current) return;
    restoredRef.current = true;
    const history = latestData.current?.conversations ?? [];
    const decision = decideRestoredConversation({
      enabled: readChatFlag("restoreLastChat"),
      storedId: readLastConversationId(),
      accessibleIds: history.map((item) => item.id),
      requestedId: new URLSearchParams(window.location.search).get("conversation"),
      historyAvailable: !(latestData.current?.error && history.length === 0),
    });
    if (decision.forgetStoredId) forgetLastConversationId();
    if (!decision.conversationId) return;
    const item = history.find((conversation) => conversation.id === decision.conversationId);
    if (!item) return;
    setMode(modelForComposer({ hasConversation: true, conversationModel: item.selected_model, accountDefault: savedPreferences.defaultModel, available: availableModes }) ?? "Balanced");
    pinLatestRef.current = true;
    setPendingId(item.id);
    router.replace(conversationPath(item.id), { scroll: false });
  }, [availableModes, preview, router, savedPreferences.defaultModel]);
  useEffect(() => {
    if (preview || !activeId || !shownConversations.some((item) => item.id === activeId)) return;
    writeLastConversationId(activeId);
  }, [activeId, preview, shownConversations]);
  const beginRecovery = (next: Recovery) => { recoveryEpoch.current += 1; setRecovery(next); };
  const recoveryConversationId = recovery?.conversationId ?? null;
  useEffect(() => {
    if (!recoveryConversationId) return;
    const epoch = recoveryEpoch.current;
    let polls = 0;
    let awaitingFinal = false;
    let snapshotAtFinal: PersistedMessage[] | null = null;
    let finalWaits = 0;
    const readAuthoritative = () => {
      const data = latestData.current;
      if (data && data.activeId === recoveryConversationId) return data.messages;
      return acceptedMessagesRef.current;
    };
    router.refresh();
    const timer = setInterval(() => {
      if (epoch !== recoveryEpoch.current) { clearInterval(timer); return; }
      const authoritative = readAuthoritative();
      if (awaitingFinal) {
        finalWaits += 1;
        const arrived = authoritative !== snapshotAtFinal;
        if (!arrived && finalWaits < 4) return;
        clearInterval(timer);
        // A streaming row after the authoritative read is still in progress. Stop polling, but do not unlock Retry.
        if (!arrived || hasActiveGeneration(authoritative)) { setNotice(checkAgainNotice); return; }
        setRecovery(null);
        setNotice(latestReplyFailed(authoritative) ? failureNotice : "");
        return;
      }
      polls += 1;
      const action = recoveryPollAction(polls, authoritative);
      if (action === "final-check") {
        awaitingFinal = true;
        snapshotAtFinal = authoritative;
        router.refresh();
        return;
      }
      if (action === "give-up") {
        clearInterval(timer);
        const messages = authoritative;
        if (hasActiveGeneration(messages)) { setNotice(checkAgainNotice); return; }
        setRecovery(null);
        setNotice(!messages.some((message) => message.role === "assistant" && message.status && message.status !== "streaming") ? unconfirmedNotice : latestReplyFailed(messages) ? failureNotice : "");
        return;
      }
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

  // An empty chat follows the account default. A model picked on that empty chat stays until New chat is opened again.
  useEffect(() => {
    if (activeId || pinnedNewChatMode.current) return;
    setMode(modelForComposer({ hasConversation: false, accountDefault: savedPreferences.defaultModel, available: availableModes }) ?? "Balanced");
  }, [activeId, availableModes, savedPreferences.defaultModel]);

  const openConversation = useStableCallback((id: string | null) => {
    if (busy.current && !streamController.current) return;
    streamController.current?.abort();
    setNotice(""); setDrawerOpen(false); setEditingId(null); setRecovery(null); setContextDiagnostics(null); setPendingRoomId(null); setPendingDraft(false); pinLatestRef.current = true;
    const item = shownConversations.find((conversation) => conversation.id === id);
    if (item) {
      pinnedNewChatMode.current = false;
      setMode(modeFor(item.selected_model, true));
    } else if (!id) {
      pinnedNewChatMode.current = false;
      setMode(modeFor(undefined, false));
    }
    if (preview) setPreviewActiveId(id);
    else { setPendingId(id); router.push(id ? conversationPath(id) : chatPath); }
    requestAnimationFrame(() => menuButtonRef.current?.focus());
  });
  // New chat opens the empty conversation immediately. The conversation row is created with the first message, so there is no
  // server work (and no empty "New chat" entries left in history) until the user actually sends something.
  const newChat = useStableCallback(() => {
    if (busy.current) return;
    composerRef.current?.clear();
    openConversation(null);
  });
  const openRoom = useStableCallback((id: string) => {
    if (busy.current && !streamController.current) return;
    streamController.current?.abort();
    setNotice(""); setDrawerOpen(false); setEditingId(null); setRecovery(null); setContextDiagnostics(null);
    setPendingId(null); setPendingRoomId(id); setPendingDraft(false); pinLatestRef.current = true;
    if (preview) setPreviewActiveId(null);
    else router.push(roomPath(id));
  });
  const newThreadInRoom = useStableCallback((id: string) => {
    if (busy.current) return;
    composerRef.current?.clear();
    setNotice(""); setDrawerOpen(false); setEditingId(null); setRecovery(null); setContextDiagnostics(null);
    setPendingId(null); setPendingRoomId(id); setPendingDraft(true); pinLatestRef.current = true;
    if (preview) setPreviewActiveId(null);
    else router.push(roomDraftPath(id));
    requestAnimationFrame(() => composerRef.current?.focus());
  });
  const conversationsDeleted = useStableCallback(() => {
    streamController.current?.abort();
    busy.current = false;
    setSending(false);
    setStreaming(false);
    clearStoredConversationReference(typeof window === "undefined" ? null : window.localStorage);
    setDroppedServerHistory(latestData.current ?? null);
    setLocalConversations([]);
    setLocalMessages({});
    setRemovedIds([]);
    setEditingId(null);
    setRecovery(null);
    setNotice("");
    setSettingsOpen(false);
    openConversation(null);
    router.refresh();
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
      const response = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ conversationId: id, userMessageId, model: mode, ...(requestReasoning !== "auto" ? { reasoning: requestReasoning } : {}), ...(options.regenerate ? { regenerate: true } : {}), ...(options.fileIds?.length ? { fileIds: options.fileIds } : {}) }), signal: controller.signal });
      if (!response.ok || !response.body) { if (!response.ok) httpStatus = response.status; const payload = await response.json().catch(() => null); throw new Error(payload?.error ?? failureNotice); }
      for await (const data of readChatSse(response.body)) {
        if (data.type === "start") {
          assistantId = data.id;
          if (data.context) setContextDiagnostics(data.context);
          // The server has replaced the previous reply once it announces the new one, so hide the old row only now.
          if (options.replaceIds?.length) setRemovedIds((ids) => [...ids, ...options.replaceIds!]);
          const reply: PersistedMessage = { id: data.id, role: "assistant", content: "", position: data.position, status: "streaming", created_at: new Date().toISOString() };
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
        setNotice(kind === "lost-connection" ? droppedConnectionNotice : kind === "in-progress" ? stillFinishingNotice : "");
        const knownAssistantId = assistantId ?? activeAssistantId([...(localMessages[id] ?? []), ...(latestData.current?.messages ?? [])]);
        beginRecovery({ conversationId: id, assistantId: knownAssistantId, baseline: latestData.current ?? { conversations: [], messages: [], activeId: id, error: null } });
      } else {
        // The server reported this failure itself, so it is final.
        if (assistantId) setLocalMessages((items) => ({ ...items, [id]: (items[id] ?? []).map((message) => message.id === assistantId ? { ...message, content: message.content || "Response unavailable.", status: "error" } : message) }));
        setNotice(failureNotice);
        router.refresh();
      }
    } finally { clearPlaceholder(); if (flushTimer) clearTimeout(flushTimer); if (streamController.current === controller) streamController.current = null; busy.current = false; setSending(false); setStreaming(false); }
  }
  const submitMessage = useStableCallback(async (content: string) => {
    if (!content || busy.current || recovery) return;
    busy.current = true;
    setSending(true); setNotice(""); setEditingId(null); followRef.current = followAfterSending(autoFollowRef.current);
    let id = activeId;
    try {
      if (preview) {
        const id = activeId ?? `preview-local-${crypto.randomUUID()}`;
        const item = activeConversation ?? { id, title: content.slice(0, 42), selected_model: mode, room_id: selectedRoomId, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
        const row: PersistedMessage = { id: `local-${crypto.randomUUID()}`, role: "user", content, position: messages.length + 1, created_at: new Date().toISOString() };
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
      const stamped = new Date().toISOString();
      setLocalMessages((items) => ({ ...items, [key]: [...withoutPending(items[key]), { id: messageId, role: "user", content, position: basePosition + 1, status: "complete", created_at: stamped }, { id: placeholderId, role: "assistant", content: "", position: basePosition + 2, status: "streaming", created_at: stamped }] }));
      composerRef.current?.clear();
      const rollback = (message: string, from: string) => { setLocalMessages((items) => ({ ...items, [from]: withoutPending(items[from]) })); composerRef.current?.restore(content); setNotice(message); };
      let saved: { id: string; position: number };
      if (!id) {
        // The first message of a new chat creates the conversation and saves the message in a single round trip.
        const started = await startConversationAction(mode, messageId, content, drafting ? selectedRoomId : null);
        if (started.error || !started.data) { rollback(started.error ?? "Conversation couldn't be created.", key); return; }
        const { conversation } = started.data;
        saved = started.data.message;
        id = conversation.id;
        const savedConversation = { ...conversation, room_id: conversation.room_id ?? (drafting ? selectedRoomId : null) };
        setLocalConversations((items) => [savedConversation, ...items]);
        setLocalMessages((items) => { const { "": rows = [], ...rest } = items; return { ...rest, [conversation.id]: rows }; });
        setPendingId(conversation.id);
        setPendingRoomId(null);
        setPendingDraft(false);
        router.push(conversationPath(conversation.id));
      } else {
        const result = await addUserMessageAction(id, content, messageId);
        if (result.error || !result.data) { rollback(result.error ?? "Message couldn't be saved.", id); return; }
        saved = result.data;
      }
      submission.current = null;
      setLocalMessages((items) => ({ ...items, [id!]: (items[id!] ?? []).map((row) => row.id === messageId ? { ...row, position: saved.position } : row.id === placeholderId ? { ...row, position: saved.position + 1 } : row) }));
      setLocalConversations((items) => items.map((item) => item.id === id ? { ...item, title: item.title === "New chat" ? content.slice(0, 42) + (content.length > 42 ? "…" : "") : item.title, updated_at: new Date().toISOString() } : item));
      const fileIds = selectedFileIds;
      rememberRoomFileSelection(messageId, fileIds);
      await generate(id, messageId, { placeholderId, fileIds });
    } catch {
      setNotice("Nibie couldn't complete that response. Please try again.");
      if (!preview) router.refresh();
    } finally { busy.current = false; setSending(false); }
  });

  // Last-turn controls: only the latest user message can be edited, and only its reply can be regenerated.
  function repliesAfter(message: PersistedMessage) { return messages.filter((item) => item.role === "assistant" && item.position > message.position).map((item) => item.id); }
  const regenerate = useStableCallback(async () => {
    if (preview || busy.current || recovery || !activeId || !lastUser) return;
    busy.current = true; setSending(true); setNotice(""); setEditingId(null); followRef.current = followAfterSending(autoFollowRef.current);
    try { await generate(activeId, lastUser.id, { regenerate: true, replaceIds: repliesAfter(lastUser), fileIds: readRoomFileSelection(lastUser.id) }); }
    finally { busy.current = false; setSending(false); }
  });
  const saveEdit = useStableCallback(async (messageId: string, content: string) => {
    if (preview || busy.current || recovery || !activeId || !lastUser || lastUser.id !== messageId || !content || content === lastUser.content) return;
    const id = activeId; const target = lastUser; const replaceIds = repliesAfter(target);
    busy.current = true; setSending(true); setNotice(""); followRef.current = followAfterSending(autoFollowRef.current);
    try {
      const result = await editLastUserMessageAction(id, target.id, content);
      if (result.error || !result.data) { setNotice(result.error ?? "Your edit couldn't be saved."); return; }
      setEditingId(null);
      setRemovedIds((ids) => [...ids, ...replaceIds]);
      setLocalMessages((items) => ({ ...items, [id]: [{ id: target.id, role: "user", content, position: target.position, status: "complete", created_at: target.created_at }] }));
      rememberRoomFileSelection(target.id, selectedFileIds);
      await generate(id, target.id, { fileIds: selectedFileIds });
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
    if (!activeId) pinnedNewChatMode.current = true;
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
    forgetLastConversationId(item.id);
    setLocalConversations((items) => items.filter((entry) => entry.id !== item.id));
    setLocalMessages((items) => { const next = { ...items }; delete next[item.id]; return next; });
    if (activeId === item.id) openConversation(null);
    router.refresh();
  });
  const moveThread = useStableCallback(async (roomId: string | null) => {
    if (!activeId || !activeConversation || activeConversation.room_id === roomId) return;
    const previous = activeConversation.room_id ?? null;
    const next = { ...activeConversation, room_id: roomId, updated_at: new Date().toISOString() };
    setLocalConversations((items) => items.some((item) => item.id === activeId) ? items.map((item) => item.id === activeId ? next : item) : [next, ...items]);
    if (preview) return;
    const result = await moveConversationAction(activeId, roomId);
    if (result.error) {
      setNotice(result.error);
      setLocalConversations((items) => items.map((item) => item.id === activeId ? { ...next, room_id: previous } : item));
      return;
    }
    router.refresh();
  });
  const createRoom = useStableCallback(async (draft: RoomDraft, brief: RoomBriefFields) => {
    const nextBrief = { goal: brief.goal, current_focus: brief.currentFocus, important_decisions: brief.importantDecisions, open_questions: brief.openQuestions, next_step: brief.next };
    if (preview) {
      const room: RoomSummary = { id: `preview-room-${crypto.randomUUID()}`, name: draft.name.trim(), description: draft.description?.trim() || null, instructions: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), brief: nextBrief };
      setRoomOverrides((items) => ({ ...items, [room.id]: room }));
      openRoom(room.id);
      return {};
    }
    const result = await createRoomAction(draft, brief);
    if (result.error || !result.data) return { error: result.error ?? "We couldn't save that change. Please try again." };
    const room: RoomSummary = result.data;
    setRoomOverrides((items) => ({ ...items, [room.id]: room }));
    openRoom(room.id);
    router.refresh();
    return {};
  });
  const saveRoom = useStableCallback(async (patch: { name: string; description: string | null; instructions: string | null }) => {
    if (!activeRoom) return { error: "That room is no longer available." };
    if (preview) {
      setRoomOverrides((items) => ({ ...items, [activeRoom.id]: { ...activeRoom, ...patch, updated_at: new Date().toISOString() } }));
      return {};
    }
    const result = await updateRoomAction(activeRoom.id, patch);
    if (result.error || !result.data) return { error: result.error ?? "We couldn't save that change. Please try again." };
    const saved = result.data;
    setRoomOverrides((items) => ({ ...items, [activeRoom.id]: { ...activeRoom, ...saved, brief: activeRoom.brief } }));
    router.refresh();
    return {};
  });
  const saveBrief = useStableCallback(async (brief: RoomBriefFields) => {
    if (!activeRoom) return { error: "That room is no longer available." };
    const nextBrief = { goal: brief.goal, current_focus: brief.currentFocus, important_decisions: brief.importantDecisions, open_questions: brief.openQuestions, next_step: brief.next };
    if (preview) {
      setRoomOverrides((items) => ({ ...items, [activeRoom.id]: { ...activeRoom, brief: nextBrief, updated_at: new Date().toISOString() } }));
      return {};
    }
    const result = await updateRoomBriefAction(activeRoom.id, brief);
    if (result.error) return { error: result.error };
    setRoomOverrides((items) => ({ ...items, [activeRoom.id]: { ...activeRoom, brief: nextBrief, updated_at: new Date().toISOString() } }));
    router.refresh();
    return {};
  });
  const removeRoom = useStableCallback(async () => {
    if (!activeRoom) return { error: "That room is no longer available." };
    if (!preview) {
      const result = await deleteRoomAction(activeRoom.id);
      if (result.error) return { error: result.error };
    }
    const id = activeRoom.id;
    setRoomOverrides((items) => ({ ...items, [id]: null }));
    setLocalConversations((items) => {
      const map = new Map(items.map((item) => [item.id, item]));
      for (const item of shownConversations) if (item.room_id === id) map.set(item.id, { ...item, room_id: null });
      return [...map.values()];
    });
    openConversation(null);
    if (!preview) router.refresh();
    return {};
  });
  const closeDrawer = useStableCallback(() => { setDrawerOpen(false); menuButtonRef.current?.focus(); });
  const openRoomSetup = useStableCallback(() => { setDrawerOpen(false); setCreatingRoom(true); });
  const closeRoomSetup = useStableCallback(() => setCreatingRoom(false));
  const openSettings = useStableCallback(() => { setDrawerOpen(false); setSettingsSection("general"); setSettingsOpen(true); });
  const editProfile = useStableCallback(() => { setDrawerOpen(false); setSettingsSection("profile"); setSettingsOpen(true); });
  const closeSettings = useStableCallback(() => setSettingsOpen(false));
  const stopStream = useStableCallback(() => streamController.current?.abort());
  const cancelEdit = useStableCallback(() => setEditingId(null));
  const startEdit = useStableCallback((id: string) => setEditingId(id));

  const history = activeId ? activeId : null;
  const caption = preview ? "Mock workspace · Messages stay in this tab and are not saved." : drafting && activeRoom ? `New thread in ${activeRoom.name}.` : streaming ? "Nibie is responding · You can stop at any time." : "Your conversations are saved to your account.";
  const threadRoom = rooms.find((room) => room.id === (activeConversation?.room_id ?? (drafting ? selectedRoomId : null))) ?? null;
  const threadRoomKey = threadRoom?.id ?? null;
  const [fileRoomKey, setFileRoomKey] = useState(threadRoomKey);
  if (fileRoomKey !== threadRoomKey) {
    setFileRoomKey(threadRoomKey);
    setSelectedFileIds([]);
    setFilePickerOpen(false);
  }
  const attach = useStableCallback(() => {
    if (preview || !threadRoom) {
      setNotice(preview ? "This preview isn't connected." : "Add a file on the room page, then choose it from a thread in that room.");
      return;
    }
    setFilePickerOpen((open) => !open);
  });
  const contextRoom = threadRoom ? roomContextFromRows({ name: threadRoom.name, instructions: threadRoom.instructions }, threadRoom.brief) : null;
  const contextPreview = previewContextDiagnostics({
    preferences: savedPreferences,
    preferenceReadFailed: Boolean(preferencesError),
    hasEarlierMessages: messages.some((message) => message.role === "user" || message.role === "assistant"),
    room: contextRoom,
    selectedFileCount: selectedFileIds.length,
  });
  const accountName = accountDisplayName({ email, metadataName, preferredName: savedPreferences.preferredName });
  const headerRoomName = (showRoom ? activeRoom?.name : threadRoom?.name) ?? null;
  const roomThreads = activeRoom ? shownConversations.filter((item) => item.room_id === activeRoom.id) : [];
  const sidebarProps = { conversations: shownConversations, rooms, activeId: history, activeRoomId: showRoom ? selectedRoomId : threadRoom?.id ?? null, busy: controlsDisabled, preview, email, name: accountName, renderedAt, onClose: closeDrawer, onOpen: openConversation, onOpenRoom: openRoom, onCreateRoom: openRoomSetup, onNewChat: newChat, onOpenSettings: openSettings, onRename: rename, onDelete: remove };

  return <main className="chat-workspace"><ChatSidebar {...sidebarProps} />{drawerOpen && <div className="mobile-drawer"><button className="drawer-scrim" aria-label="Dismiss menu backdrop" onClick={closeDrawer} /><ChatSidebar {...sidebarProps} mobile drawerRef={drawerRef} closeMenuRef={closeMenuRef} /></div>}
    <section className="chat-main" aria-label="Chat workspace"><header className="chat-header"><button ref={menuButtonRef} className="icon-button mobile-menu-button" aria-label="Open conversation menu" onClick={() => setDrawerOpen(true)}><Menu size={21} /></button><div className="header-model"><span className="model-dot" /><span>Nibie</span><span className="header-divider">/</span><span className={`header-context${headerRoomName ? " is-room-name" : ""}`}>{headerRoomName ?? "A little room to think"}</span></div>{activeId && rooms.length ? <label className="thread-room"><span>Room</span><select aria-label="Move thread" value={activeConversation?.room_id ?? ""} disabled={controlsDisabled} onChange={(event) => void moveThread(event.target.value || null)}><option value="">General</option>{rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}</select></label> : null}<button className="header-new-chat" disabled={controlsDisabled} onClick={newChat}><Plus size={16} /><span>New chat</span></button></header>
      <div ref={scrollRef} onScroll={handleScroll} className={`conversation-scroll ${showRoom ? "is-room" : messages.length || loadingConversation ? "has-messages" : "is-empty"}`}>{showRoom && activeRoom ? <RoomDetail key={activeRoom.id} room={activeRoom} threads={roomThreads} busy={controlsDisabled} preview={preview} onOpenThread={openConversation} onNewThread={() => newThreadInRoom(activeRoom.id)} onSaveRoom={saveRoom} onSaveBrief={saveBrief} onDelete={removeRoom} /> : loadingConversation ? <div className="message-list conversation-skeleton" role="status" aria-busy="true" aria-label="Loading conversation"><div className="skeleton-line is-short" /><div className="skeleton-line" /><div className="skeleton-line" /><div className="skeleton-line is-medium" /></div> : messages.length ? <div className="message-list" aria-live="polite">{messages.map((message) => <MessageRow key={message.id} message={message} initial={initial} isLast={message.id === lastMessage?.id} isLastUser={message.id === lastUser?.id} canMutate={!preview} disabled={messageActionsLocked} editing={editingId === message.id} onRegenerate={regenerate} onStartEdit={startEdit} onCancelEdit={cancelEdit} onSaveEdit={saveEdit} />)}{notice && <p className="local-notice" role="status">{notice}</p>}</div> : <div className="welcome-panel">{notice && <p className="local-notice" role="status">{notice}</p>}<div className="welcome-icon"><BrandMark /></div><p className="welcome-eyebrow">{drafting && activeRoom ? "NEW THREAD" : "A LITTLE ROOM TO THINK"}</p><h1>{drafting && activeRoom ? activeRoom.name : "What’s on your mind?"}</h1><p className="welcome-copy">{drafting && activeRoom ? "This thread starts inside the room. Nibie will use its instructions and brief." : "A fresh page for ideas, questions, and whatever you’re working through."}</p>{drafting ? null : <div className="suggestion-list" aria-label="Suggestions">{suggestions.map((suggestion) => <button key={suggestion} onClick={() => { composerRef.current?.set(suggestion); composerRef.current?.focus(); }}>{suggestion}<span>↗</span></button>)}</div>}</div>}</div>
      {showRoom ? null : <ChatComposer ref={composerRef} sending={sending || recovering} streaming={streaming} models={models} mode={mode} reasoningModes={reasoningModes} reasoning={reasoning} caption={caption} diagnostics={contextDiagnostics ?? contextPreview} onEditProfile={editProfile} onSubmit={submitMessage} onStop={stopStream} onModeChange={changeMode} onReasoningChange={setReasoning} onAttach={attach} attachTitle={threadRoom ? "Choose a room file" : "Add a file from a room"} attachmentPanel={filePickerOpen && threadRoom ? <RoomFilePicker roomId={threadRoom.id} selectedIds={selectedFileIds} disabled={controlsDisabled || sending || streaming} onChange={setSelectedFileIds} /> : null} />}
    </section>
    {creatingRoom ? <RoomCreateDialog preview={preview} onClose={closeRoomSetup} onCreate={createRoom} /> : null}
    {settingsOpen ? <SettingsDialog initialSection={settingsSection} email={email} preview={preview} busy={controlsDisabled} models={models} initialPreferences={savedPreferences} initialError={preferencesError} onClose={closeSettings} onSaved={setSavedPreferences} onConversationsDeleted={conversationsDeleted} /> : null}
  </main>;
}
