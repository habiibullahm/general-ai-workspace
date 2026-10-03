"use client";

import { memo, useEffect, useImperativeHandle, useRef, useState, type KeyboardEvent, type ReactNode, type Ref } from "react";
import { ArrowUp, Plus, X } from "lucide-react";
import { ComposerMenu, type MenuItem } from "@/components/composer-menu";
import { ContextIndicator } from "@/components/context-indicator";
import { useChatFlag } from "@/components/use-chat-preferences";
import { composerEnterAction } from "@/lib/chat/preferences";
import type { ModelChoice, ModelOption, ReasoningEffort } from "@/lib/chat/models";
import type { ChatModel } from "@/lib/chat/validation";
import type { ContextDiagnostics } from "@/lib/context/context-types";

export type ComposerHandle = { set: (text: string) => void; restore: (text: string) => void; clear: () => void; focus: () => void };
type Props = {
  ref?: Ref<ComposerHandle>;
  sending: boolean;
  streaming: boolean;
  mode: ChatModel;
  models: ModelOption[];
  // Model and reasoning effort are independent controls: Auto follows the conversation's saved model.
  modelChoice: ModelChoice;
  onModelChange: (model: ModelChoice) => void;
  // Modes the server has verified to honour a reasoning effort. Empty: the reasoning control is not shown at all.
  reasoningModes: ChatModel[];
  reasoning: ReasoningEffort;
  caption: string;
  diagnostics: ContextDiagnostics;
  onEditProfile: () => void;
  onSubmit: (content: string) => void;
  onStop: () => void;
  onReasoningChange: (effort: ReasoningEffort) => void;
  onAttach: () => void;
  attachmentPanel?: ReactNode;
  roomItems: MenuItem<string>[];
  roomId: string;
  roomLabel: string;
  roomSelectionNotice: string | null;
  roomsLoading: boolean;
  onRoomChange?: (id: string) => void;
};

const reasoningItems: MenuItem<ReasoningEffort>[] = [
  { value: "low", label: "Low", detail: "Lighter reasoning effort" },
  { value: "medium", label: "Medium", detail: "Default reasoning effort" },
  { value: "high", label: "High", detail: "Deeper reasoning effort" },
];

// The draft lives here, not in the workspace: typing re-renders only this component, never the message list or sidebar.
export const ChatComposer = memo(function ChatComposer({ ref, sending, streaming, mode, models, modelChoice, onModelChange, reasoningModes, reasoning, caption, diagnostics, onEditProfile, onSubmit, onStop, onReasoningChange, onAttach, attachmentPanel = null, roomItems, roomId, roomLabel, roomSelectionNotice, roomsLoading, onRoomChange }: Props) {
  const [draft, setDraft] = useState("");
  const [enterToSend] = useChatFlag("enterToSend");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(ref, () => ({ set: setDraft, restore: (text) => setDraft((current) => current || text), clear: () => setDraft(""), focus: () => textareaRef.current?.focus() }), []);

  useEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = "0px";
    element.style.height = `${Math.min(element.scrollHeight, 180)}px`;
  }, [draft]);

  function submit() {
    const content = draft.trim();
    if (content && !sending && !streaming) onSubmit(content);
  }
  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    const action = composerEnterAction({ key: event.key, shiftKey: event.shiftKey, metaKey: event.metaKey, ctrlKey: event.ctrlKey, composing: event.nativeEvent.isComposing, enterToSend });
    if (action === "send") { event.preventDefault(); submit(); }
  }

  const reasoningSupported = reasoningModes.includes(mode);
  const modelItems: MenuItem<ModelChoice>[] = [{ value: "Auto", label: "Auto" }, ...models.map((option) => ({ value: option.id, label: option.label }))];

  return <div className="composer-dock"><ContextIndicator diagnostics={diagnostics} onEditProfile={onEditProfile} />{attachmentPanel}<form className="composer" onSubmit={(event) => { event.preventDefault(); submit(); }}>
    <textarea ref={textareaRef} aria-label="Message Nibie" placeholder="Ask Nibie..." enterKeyHint={enterToSend ? "send" : "enter"} value={draft} rows={1} onChange={(event) => setDraft(event.target.value)} onKeyDown={handleKeyDown} />
    {onRoomChange && roomSelectionNotice ? <p className="composer-room-notice" role="status">{roomSelectionNotice}</p> : null}
    <div className="composer-tools"><div className="composer-left-tools">
      <button className="composer-icon" type="button" aria-label="Attach file" title="Attach file" aria-pressed={Boolean(attachmentPanel)} onClick={onAttach}><Plus size={18} /></button>
      {onRoomChange ? <ComposerMenu name="Room" value={roomId} items={roomItems} onChange={onRoomChange} disabled={sending || streaming || roomsLoading} disabledReason={roomsLoading ? "Loading rooms" : "Message is being sent"} /> : <span className="composer-room-context" aria-label={`Room context: ${roomLabel}`} title={roomLabel}>{roomLabel}</span>}
      <ComposerMenu name="Model" value={modelChoice} items={modelItems} onChange={onModelChange} disabled={sending || streaming || !models.length} disabledReason="A response is running or no models are configured" />
      <ComposerMenu name="Reasoning" value={reasoning === "auto" ? "medium" : reasoning} items={reasoningItems} onChange={onReasoningChange} disabled={!reasoningSupported || sending || streaming} disabledReason={reasoningSupported ? "A response is running" : "Reasoning effort is unavailable for this chat"} />
    </div>
    {streaming ? <button key="stop" className="send-button" type="button" aria-label="Stop response" onClick={onStop}><X size={18} /></button> : <button key="send" className="send-button" type="submit" aria-label="Send message" disabled={!draft.trim() || sending}>{sending ? <span className="send-spinner" /> : <ArrowUp size={18} strokeWidth={2.3} />}</button>}</div></form><p className="composer-caption" role="status">{caption}</p></div>;
});
