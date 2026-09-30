"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import Link from "next/link";
import { ArrowUp, Check, ChevronDown, FilePlus2, Menu, MessageSquare, Plus, Sparkles, X } from "lucide-react";
import { signOutAction } from "@/app/actions/auth";

type Message = { role: "user" | "assistant"; text: string };
type Conversation = { id: string; title: string; age: "Today" | "Yesterday" | "Older"; messages: Message[] };

const initialConversations: Conversation[] = [
  { id: "writing", title: "A thoughtful note to the team", age: "Today", messages: [
    { role: "user", text: "Help me write a thoughtful note to my team after a busy launch week." },
    { role: "assistant", text: "A good note can recognize the effort, name what the team accomplished, and leave room for everyone to recharge.\n\nYou might start with what you noticed most: the care people brought to the final details, the way they supported one another, or a moment that made you proud." },
  ] },
  { id: "weekend", title: "Ideas for a quiet weekend", age: "Today", messages: [
    { role: "user", text: "I want a weekend that feels restorative without being too planned." },
    { role: "assistant", text: "Leave one anchor for each day and let the rest stay open. A slow breakfast, a walk somewhere green, and a small thing you have been meaning to read can be enough structure." },
  ] },
  { id: "learning", title: "Learning the basics of astronomy", age: "Yesterday", messages: [
    { role: "user", text: "Where should I begin if I want to learn astronomy?" },
    { role: "assistant", text: "Start by looking up. Learning a few bright constellations and the phases of the Moon gives you a useful map. From there, the scale of the solar system becomes much easier to picture." },
  ] },
  { id: "meal", title: "Simple meals for busy evenings", age: "Yesterday", messages: [
    { role: "user", text: "What are a few flexible dinner ideas for a busy week?" },
    { role: "assistant", text: "Think in building blocks: a grain, a vegetable, and something filling. A tray of roasted vegetables with chickpeas, or rice with eggs and whatever greens you have, can shift with the season." },
  ] },
  { id: "journal", title: "A gentle journaling routine", age: "Older", messages: [
    { role: "user", text: "How can I make journaling feel less like homework?" },
    { role: "assistant", text: "Make the bar almost comically small: one sentence, a few times a week. You can write what stayed with you today, what surprised you, or what you would like to make space for tomorrow." },
  ] },
  { id: "reading", title: "Books for a long train ride", age: "Older", messages: [
    { role: "user", text: "I need a book that is easy to settle into on a long trip." },
    { role: "assistant", text: "A collection of linked essays or short stories can be especially forgiving: each piece gives you a natural stopping point while still rewarding a longer stretch of reading." },
  ] },
];

const suggestions = ["Help me think through an idea", "Write something with me", "Explain a new topic"];

export function ChatWorkspace({ email }: { email: string }) {
  const [conversations, setConversations] = useState(initialConversations);
  const [activeId, setActiveId] = useState<string | null>("writing");
  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState("Balanced");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeMenuRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const activeConversation = conversations.find((item) => item.id === activeId);

  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "0px";
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
  }, [draft]);

  useEffect(() => {
    if (!drawerOpen) return;
    closeMenuRef.current?.focus();
    function handleDrawerKeydown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        setDrawerOpen(false);
        menuButtonRef.current?.focus();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = drawerRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", handleDrawerKeydown);
    return () => window.removeEventListener("keydown", handleDrawerKeydown);
  }, [drawerOpen]);

  function newChat() {
    setActiveId(null);
    setDraft("");
    setNotice("");
    setDrawerOpen(false);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  function submitMessage(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    const id = activeId ?? `local-${Date.now()}`;
    const title = text.length > 42 ? `${text.slice(0, 42).trim()}…` : text;
    setConversations((items) => {
      const current = items.find((item) => item.id === id);
      const message: Message = { role: "user", text };
      if (current) return items.map((item) => item.id === id ? { ...item, messages: [...item.messages, message] } : item);
      return [{ id, title, age: "Today", messages: [message] }, ...items];
    });
    setActiveId(id);
    setDraft("");
    setNotice("Your message is shown in this local preview. Replies are not connected yet.");
    window.setTimeout(() => setSending(false), 500);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submitMessage();
    }
  }

  function chooseConversation(id: string) {
    setActiveId(id);
    setNotice("");
    setDrawerOpen(false);
    requestAnimationFrame(() => menuButtonRef.current?.focus());
  }

  const groups = ["Today", "Yesterday", "Older"] as const;
  const sidebar = (mobile = false) => (
    <aside ref={mobile ? drawerRef : undefined} className={mobile ? "workspace-sidebar mobile-sidebar" : "workspace-sidebar desktop-sidebar"} aria-label={mobile ? "Conversation menu" : "Conversation history"} role={mobile ? "dialog" : undefined} aria-modal={mobile ? true : undefined}>
      <div className="sidebar-top">
        <Link href="/" className="brand-lockup" aria-label="Nibie home"><span className="brand-mark">n</span><span>nibie</span></Link>
        {mobile && <button ref={closeMenuRef} className="icon-button" aria-label="Close menu" onClick={() => { setDrawerOpen(false); menuButtonRef.current?.focus(); }}><X size={19} /></button>}
      </div>
      <button className="new-chat-button" onClick={newChat}><Plus size={17} strokeWidth={2.2} /> <span>New chat</span></button>
      <nav className="history-nav" aria-label="Conversations">
        {groups.map((group) => {
          const entries = conversations.filter((conversation) => conversation.age === group);
          if (!entries.length) return null;
          return <section className="history-group" key={group} aria-label={group}>
            <h2>{group}</h2>
            {entries.map((conversation) => <button key={conversation.id} className={`history-item ${activeId === conversation.id ? "is-active" : ""}`} onClick={() => chooseConversation(conversation.id)} title={conversation.title}>
              <MessageSquare size={15} /><span>{conversation.title}</span>
            </button>)}
          </section>;
        })}
      </nav>
      <div className="account-area">
        <div className="account-card"><div className="avatar">{email.slice(0, 1).toUpperCase()}</div><span className="account-email" title={email}>{email}</span><ChevronDown size={15} /></div>
        <form action={signOutAction}><button className="signout-button" type="submit">Sign out</button></form>
      </div>
    </aside>
  );

  return <main className="chat-workspace">
    {sidebar()}
    {drawerOpen && <div className="mobile-drawer"><button className="drawer-scrim" aria-label="Dismiss menu backdrop" onClick={() => { setDrawerOpen(false); menuButtonRef.current?.focus(); }} />{sidebar(true)}</div>}
    <section className="chat-main" aria-label="Chat workspace">
      <header className="chat-header">
        <button ref={menuButtonRef} className="icon-button mobile-menu-button" aria-label="Open conversation menu" onClick={() => setDrawerOpen(true)}><Menu size={21} /></button>
        <div className="header-model"><span className="model-dot" /><span>Nibie</span><span className="header-divider">/</span><span className="header-context">A little room to think</span></div>
        <button className="header-new-chat" onClick={newChat}><Plus size={16} /><span>New chat</span></button>
      </header>

      <div className={`conversation-scroll ${activeConversation ? "has-messages" : "is-empty"}`}>
        {activeConversation ? <div className="message-list" aria-live="polite">
          {activeConversation.messages.map((message, index) => <article className={`message-row ${message.role}`} key={`${activeConversation.id}-${index}`}>
            {message.role === "assistant" ? <div className="assistant-badge"><Sparkles size={15} /></div> : null}
            <div className={`message-content ${message.role}`}>
              {message.role === "assistant" && <div className="message-author">Nibie</div>}
              <p>{message.text}</p>
            </div>
            {message.role === "user" && <div className="user-avatar" aria-label="You">{email.slice(0, 1).toUpperCase()}</div>}
          </article>)}
          {notice && <p className="local-notice" role="status"><Check size={14} />{notice}</p>}
        </div> : <div className="welcome-panel">
          <div className="welcome-icon"><Sparkles size={19} strokeWidth={1.7} /></div>
          <p className="welcome-eyebrow">A LITTLE ROOM TO THINK</p>
          <h1>What’s on your mind?</h1>
          <p className="welcome-copy">A fresh page for ideas, questions, and whatever you’re working through.</p>
          <div className="suggestion-list" aria-label="Suggestions">{suggestions.map((suggestion) => <button key={suggestion} onClick={() => { setDraft(suggestion); textareaRef.current?.focus(); }}>{suggestion}<span>↗</span></button>)}</div>
        </div>}
      </div>

      <div className="composer-dock">
        <form className="composer" onSubmit={submitMessage}>
          <textarea ref={textareaRef} aria-label="Message Nibie" placeholder="Message Nibie…" value={draft} rows={1} onChange={(event) => setDraft(event.target.value)} onKeyDown={handleKeyDown} />
          <div className="composer-tools">
            <div className="composer-left-tools">
              <button className="composer-icon" type="button" aria-label="Attach a file" title="Attachments are not available in this preview" onClick={() => setNotice("Attachments are not available in this preview.")}><FilePlus2 size={18} /></button>
              <label className="mode-select-label" htmlFor="response-mode">Response mode</label>
              <select id="response-mode" aria-label="Response mode" value={mode} onChange={(event) => setMode(event.target.value)}><option>Fast</option><option>Balanced</option><option>Reasoning</option></select>
              <ChevronDown className="select-chevron" size={13} aria-hidden="true" />
            </div>
            <button className="send-button" type="submit" aria-label="Send message" disabled={!draft.trim() || sending}>{sending ? <span className="send-spinner" /> : <ArrowUp size={18} strokeWidth={2.3} />}</button>
          </div>
        </form>
        <p className="composer-caption">Mock workspace · Messages stay in this tab and are not saved.</p>
      </div>
    </section>
  </main>;
}
