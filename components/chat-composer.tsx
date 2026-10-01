"use client";

import { memo, useEffect, useImperativeHandle, useRef, useState, type KeyboardEvent, type Ref } from "react";
import { ArrowUp, ChevronDown, FilePlus2, X } from "lucide-react";
import type { ChatModel } from "@/lib/chat/validation";

export type ComposerHandle = { set: (text: string) => void; clear: () => void; focus: () => void };
type Props = {
  ref?: Ref<ComposerHandle>;
  sending: boolean;
  streaming: boolean;
  mode: ChatModel;
  caption: string;
  onSubmit: (content: string) => void;
  onStop: () => void;
  onModeChange: (mode: string) => void;
  onAttach: () => void;
};

// The draft lives here, not in the workspace: typing re-renders only this component, never the message list or sidebar.
export const ChatComposer = memo(function ChatComposer({ ref, sending, streaming, mode, caption, onSubmit, onStop, onModeChange, onAttach }: Props) {
  const [draft, setDraft] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(ref, () => ({ set: setDraft, clear: () => setDraft(""), focus: () => textareaRef.current?.focus() }), []);

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
    if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); submit(); }
  }

  return <div className="composer-dock"><form className="composer" onSubmit={(event) => { event.preventDefault(); submit(); }}><textarea ref={textareaRef} aria-label="Message Nibie" placeholder="Message Nibie…" value={draft} rows={1} onChange={(event) => setDraft(event.target.value)} onKeyDown={handleKeyDown} /><div className="composer-tools"><div className="composer-left-tools"><button className="composer-icon" type="button" aria-label="Attach a file" title="Attachments are not available" onClick={onAttach}><FilePlus2 size={18} /></button><label className="mode-select-label" htmlFor="response-mode">Response mode</label><select id="response-mode" aria-label="Response mode" disabled={sending || streaming} value={mode} onChange={(event) => onModeChange(event.target.value)}><option>Fast</option><option>Balanced</option><option>Reasoning</option></select><ChevronDown className="select-chevron" size={13} aria-hidden="true" /></div>{streaming ? <button className="send-button" type="button" aria-label="Stop response" onClick={onStop}><X size={18} /></button> : <button className="send-button" type="submit" aria-label="Send message" disabled={!draft.trim() || sending}>{sending ? <span className="send-spinner" /> : <ArrowUp size={18} strokeWidth={2.3} />}</button>}</div></form><p className="composer-caption" role="status">{caption}</p></div>;
});
