"use client";

import { memo, useEffect, useImperativeHandle, useRef, useState, type KeyboardEvent, type ReactNode, type Ref } from "react";
import { ArrowUp, FilePlus2, X } from "lucide-react";
import { ComposerMenu, type MenuItem } from "@/components/composer-menu";
import { ContextIndicator } from "@/components/context-indicator";
import { useChatFlag } from "@/components/use-chat-preferences";
import { composerEnterAction } from "@/lib/chat/preferences";
import type { ModelOption, ReasoningEffort } from "@/lib/chat/models";
import type { ChatModel } from "@/lib/chat/validation";
import type { ContextDiagnostics } from "@/lib/context/context-types";

export type ComposerHandle = { set: (text: string) => void; restore: (text: string) => void; clear: () => void; focus: () => void };
type Props = {
  ref?: Ref<ComposerHandle>;
  sending: boolean;
  streaming: boolean;
  // Only modes that are configured on the server.
  models: ModelOption[];
  mode: ChatModel;
  // Modes the server has verified to honour a reasoning effort. Empty: the reasoning control is not shown at all.
  reasoningModes: ChatModel[];
  reasoning: ReasoningEffort;
  caption: string;
  diagnostics: ContextDiagnostics;
  onEditProfile: () => void;
  onSubmit: (content: string) => void;
  onStop: () => void;
  onModeChange: (mode: ChatModel) => void;
  onReasoningChange: (effort: ReasoningEffort) => void;
  onAttach: () => void;
  attachTitle?: string;
  attachmentPanel?: ReactNode;
};

const reasoningItems: MenuItem<ReasoningEffort>[] = [
  { value: "auto", label: "Auto", detail: "Let the model decide" },
  { value: "low", label: "Low", detail: "Faster, lighter thinking" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High", detail: "Deeper thinking" },
];

// The draft lives here, not in the workspace: typing re-renders only this component, never the message list or sidebar.
export const ChatComposer = memo(function ChatComposer({ ref, sending, streaming, models, mode, reasoningModes, reasoning, caption, diagnostics, onEditProfile, onSubmit, onStop, onModeChange, onReasoningChange, onAttach, attachTitle = "Attachments are not available", attachmentPanel = null }: Props) {
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
    if (content) onSubmit(content);
  }
  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    const action = composerEnterAction({ key: event.key, shiftKey: event.shiftKey, metaKey: event.metaKey, ctrlKey: event.ctrlKey, composing: event.nativeEvent.isComposing, enterToSend });
    if (action === "send") { event.preventDefault(); submit(); }
  }

  const modelItems: MenuItem<ChatModel>[] = models.map((option) => ({ value: option.id, label: option.label, detail: option.model }));
  const reasoningSupported = reasoningModes.includes(mode);

  return <div className="composer-dock"><ContextIndicator diagnostics={diagnostics} onEditProfile={onEditProfile} />{attachmentPanel}<form className="composer" onSubmit={(event) => { event.preventDefault(); submit(); }}><textarea ref={textareaRef} aria-label="Message Nibie" placeholder="Message Nibie…" enterKeyHint={enterToSend ? "send" : "enter"} value={draft} rows={1} onChange={(event) => setDraft(event.target.value)} onKeyDown={handleKeyDown} />
    <div className="composer-tools"><div className="composer-left-tools">
      <button className="composer-icon" type="button" aria-label="Attach a file" title={attachTitle} aria-pressed={Boolean(attachmentPanel)} onClick={onAttach}><FilePlus2 size={18} /></button>
      {modelItems.length > 0 && <ComposerMenu name="Model" value={mode} items={modelItems} onChange={onModeChange} />}
      {reasoningModes.length > 0 && <ComposerMenu name="Reasoning" value={reasoningSupported ? reasoning : "auto"} items={reasoningItems} onChange={onReasoningChange} disabled={!reasoningSupported} disabledReason={`Not supported by ${mode}`} />}
    </div>
    {streaming ? <button className="send-button" type="button" aria-label="Stop response" onClick={onStop}><X size={18} /></button> : <button className="send-button" type="submit" aria-label="Send message" disabled={!draft.trim() || sending}>{sending ? <span className="send-spinner" /> : <ArrowUp size={18} strokeWidth={2.3} />}</button>}</div></form><p className="composer-caption" role="status">{caption}</p></div>;
});
