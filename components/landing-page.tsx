import { ArrowUp, MessageSquare, Plus } from "lucide-react";
import Link from "next/link";
import { Brand, BrandMark } from "@/components/brand";
import { chatPath } from "@/lib/routes";

const useCases = [
  { title: "Think", copy: "Work through a decision, a question, or an idea that is still taking shape." },
  { title: "Write", copy: "Draft, revise, and tighten language until it sounds like you." },
  { title: "Code", copy: "Talk through a bug, a change, or a design without leaving the thread." },
  { title: "Explore", copy: "Follow a subject further, then return to the same conversation." },
];

const reasons = [
  { title: "Fast for everyday answers", copy: "Use Fast when you want a direct reply and the question is already clear." },
  { title: "Balanced and Reasoning when you want more depth", copy: "Balanced is the everyday default. Reasoning is there when a problem needs a slower pass." },
  { title: "Personalization you set yourself", copy: "Language, length, style, name, and About you change only when you change them." },
  { title: "A workspace, not a feed", copy: "Conversations stay in a list you can return to. Nothing else is competing for the page." },
];

const preferences = [
  { title: "Preferred language", copy: "Auto, English, or Bahasa Indonesia." },
  { title: "Default model", copy: "Fast, Balanced, or Reasoning for new chats." },
  { title: "Response length", copy: "Concise, Balanced, or Detailed." },
  { title: "Response style", copy: "Natural, Professional, or Direct." },
  { title: "Preferred name", copy: "A short name, saved only if you enter one." },
  { title: "About you", copy: "Role, goals, or working context. Leave it blank to keep it clear." },
];

const boundaries = [
  { title: "Account-scoped conversations", copy: "Conversations belong to the account that created them." },
  { title: "Credentials stay on the server", copy: "AI provider credentials are used on the server and are not sent to the browser." },
  { title: "Database access controls", copy: "Database-level access controls protect user-owned rows." },
  { title: "Explicit personalization", copy: "Personalization is limited to the preferences you choose to save." },
];

export function LandingPage() {
  return <div className="landing">
    <a className="skip-link" href="#content">Skip to content</a>
    <header className="landing-header">
      <nav className="landing-nav" aria-label="Primary">
        <Brand href="/" label="Nibie" />
        <div className="landing-nav-links">
          <a href="#product">Product</a>
          <a href="#privacy">Privacy/Security</a>
          <Link className="landing-button" href={chatPath}>Open Nibie</Link>
        </div>
      </nav>
    </header>
    <main id="content">
      <section className="landing-hero" aria-labelledby="landing-hero-title">
        <p className="landing-kicker">Personal AI workspace</p>
        <h1 id="landing-hero-title">A quieter place to think with AI.</h1>
        <p className="landing-lede">Nibie is your personal AI workspace for thinking, writing, coding, exploring ideas, and getting work done — without the clutter.</p>
        <div className="landing-actions">
          <Link className="landing-button" href={chatPath}>Open Nibie</Link>
          <a className="landing-button landing-button-secondary" href="#product">See how it works</a>
        </div>
      </section>

      <section className="landing-section" id="product" aria-labelledby="landing-product-title">
        <div className="landing-section-copy">
          <h2 id="landing-product-title">The workspace</h2>
          <p>A conversation, a mode you choose, and a composer. That is the workspace.</p>
        </div>
        <figure className="landing-figure">
          <div className="landing-frame" aria-hidden="true">
            <div className="chat-workspace">
              <aside className="workspace-sidebar desktop-sidebar">
                <div className="sidebar-top"><Brand /></div>
                <div className="new-chat-button"><Plus size={17} strokeWidth={2.2} /> <span>New chat</span></div>
                <div className="history-nav">
                  <section className="history-group">
                    <p>Today</p>
                    <div className="history-entry"><div className="history-item is-active"><MessageSquare size={15} /><span>Tighten the team note</span></div></div>
                    <div className="history-entry"><div className="history-item"><MessageSquare size={15} /><span>Sketch of the parser</span></div></div>
                  </section>
                  <section className="history-group">
                    <p>Yesterday</p>
                    <div className="history-entry"><div className="history-item"><MessageSquare size={15} /><span>Questions about the launch</span></div></div>
                  </section>
                </div>
              </aside>
              <section className="chat-main">
                <header className="chat-header">
                  <div className="icon-button mobile-menu-button"><span className="landing-menu-glyph" /></div>
                  <div className="header-model"><span className="model-dot" /><span>Nibie</span><span className="header-divider">/</span><span className="header-context">A little room to think</span></div>
                  <div className="header-new-chat"><Plus size={16} /><span>New chat</span></div>
                </header>
                <div className="conversation-scroll has-messages">
                  <div className="message-list">
                    <div className="message-row user">
                      <div className="message-column user">
                        <div className="message-content user"><p>Help me tighten this before I send it to the team.</p></div>
                      </div>
                      <div className="user-avatar">Y</div>
                    </div>
                    <div className="message-row assistant">
                      <div className="assistant-badge"><BrandMark /></div>
                      <div className="message-content assistant">
                        <p className="message-author">Nibie</p>
                        <p>Lead with the decision, then the reason. One sentence on what changed is enough.</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="composer-dock">
                  <div className="composer">
                    <p className="landing-composer-placeholder">Message Nibie…</p>
                    <div className="composer-tools">
                      <div className="landing-modes"><span>Fast</span><span className="is-selected">Balanced</span><span>Reasoning</span></div>
                      <div className="send-button"><ArrowUp size={18} strokeWidth={2.3} /></div>
                    </div>
                  </div>
                  <p className="composer-caption">Your conversations are saved to your account.</p>
                </div>
              </section>
            </div>
          </div>
          <figcaption>Illustration of the Nibie workspace, with a conversation, a model mode, and the composer.</figcaption>
        </figure>
      </section>

      <section className="landing-section" aria-labelledby="landing-uses-title">
        <div className="landing-section-copy">
          <h2 id="landing-uses-title">What you can do here</h2>
          <p>Practical work, in a thread you can come back to.</p>
        </div>
        <div className="landing-grid landing-grid-4">
          {useCases.map((item) => <article className="landing-card" key={item.title}><h3>{item.title}</h3><p>{item.copy}</p></article>)}
        </div>
      </section>

      <section className="landing-section" aria-labelledby="landing-why-title">
        <div className="landing-section-copy">
          <h2 id="landing-why-title">AI that gets out of the way.</h2>
          <p>Modes, preferences, and a single conversation. Nothing extra on the screen.</p>
        </div>
        <div className="landing-grid landing-grid-2">
          {reasons.map((item) => <article className="landing-card" key={item.title}><h3>{item.title}</h3><p>{item.copy}</p></article>)}
        </div>
      </section>

      <section className="landing-section" aria-labelledby="landing-preferences-title">
        <div className="landing-section-copy">
          <h2 id="landing-preferences-title">Personalization you can see</h2>
          <p>These are the Settings choices that exist today. Nibie does not keep a hidden memory.</p>
        </div>
        <div className="landing-grid landing-grid-3">
          {preferences.map((item) => <article className="landing-card" key={item.title}><h3>{item.title}</h3><p>{item.copy}</p></article>)}
        </div>
      </section>

      <section className="landing-section landing-quote" aria-labelledby="landing-philosophy-title">
        <h2 id="landing-philosophy-title">AI should feel less like a feed and more like a room.</h2>
        <p>A conversation can stay open while you think, revise, and build. Leave, then come back to the same thread.</p>
      </section>

      <section className="landing-section" id="privacy" aria-labelledby="landing-privacy-title">
        <div className="landing-section-copy">
          <h2 id="landing-privacy-title">Built with clear boundaries.</h2>
          <p>What the product does today, stated plainly.</p>
        </div>
        <div className="landing-grid landing-grid-2">
          {boundaries.map((item) => <article className="landing-card" key={item.title}><h3>{item.title}</h3><p>{item.copy}</p></article>)}
        </div>
      </section>

      <section className="landing-final" aria-labelledby="landing-final-title">
        <h2 id="landing-final-title">Make some room to think.</h2>
        <p>Open the workspace when you want a quiet place to continue.</p>
        <Link className="landing-button" href={chatPath}>Open Nibie</Link>
      </section>
    </main>
  </div>;
}