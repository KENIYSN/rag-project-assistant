"use client";

function NewChatIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}

function KeyboardIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M6 8h.001M10 8h.001M14 8h.001M18 8h.001M8 12h.001M12 12h.001M16 12h.001M7 16h10" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}

export default function Sidebar({ isOpen, onClose, onNewChat, messageCount }) {
  return (
    <>
      {/* Backdrop overlay for mobile */}
      <div
        className={`sidebar-overlay${isOpen ? " visible" : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside className={`sidebar${isOpen ? " open" : ""}`}>
        {/* ── Top: New Chat Button ──────────────────────────────── */}
        <div className="sidebar-top">
          <button className="new-chat-btn" onClick={onNewChat} type="button">
            <NewChatIcon />
            <span>New Chat</span>
          </button>
        </div>

        <div className="sidebar-divider" />

        {/* ── About Section ─────────────────────────────────────── */}
        <div className="sidebar-section">
          <p className="sidebar-section-label">About</p>
          <div className="sidebar-about-card">
            <InfoIcon />
            <p>
              A <strong>Retrieval-Augmented Generation</strong> assistant that answers questions using your uploaded course PDFs. Built with vector search &amp; LLM streaming.
            </p>
          </div>
        </div>

        <div className="sidebar-divider" />

        {/* ── Tech Stack ────────────────────────────────────────── */}
        <div className="sidebar-section">
          <p className="sidebar-section-label">Tech Stack</p>
          <div className="sidebar-tech-grid">
            <span className="tech-badge">Next.js</span>
            <span className="tech-badge">FastAPI</span>
            <span className="tech-badge">MongoDB</span>
            <span className="tech-badge">OpenRouter</span>
            <span className="tech-badge">Gemma 4</span>
            <span className="tech-badge">RAG</span>
          </div>
        </div>

        <div className="sidebar-divider" />

        {/* ── Team Section ─────────────────────────────────────── */}
        <div className="sidebar-section">
          <p className="sidebar-section-label">Team</p>

          <div className="sidebar-team-list">
            <div className="sidebar-team-card">
              <img
                className="sidebar-avatar"
                src="/avatar_mohammed.png"
                alt="Mohammed Nassiri"
              />
              <div className="sidebar-member-info">
                <span className="sidebar-member-name">Mohammed Nassiri</span>
                <span className="sidebar-member-role">Frontend & LLM Integration</span>
              </div>
            </div>

            <div className="sidebar-team-card">
              <img
                className="sidebar-avatar"
                src="/avatar_yassine.png"
                alt="Yassine Esserdaoui"
              />
              <div className="sidebar-member-info">
                <span className="sidebar-member-name">Yassine Esserdaoui</span>
                <span className="sidebar-member-role">Backend & Data Pipeline</span>
              </div>
            </div>
          </div>
        </div>

        <div className="sidebar-divider" />

        {/* ── Shortcuts ────────────────────────────────────────── */}
        <div className="sidebar-section sidebar-section-compact">
          <p className="sidebar-section-label">
            <KeyboardIcon />
            Shortcuts
          </p>
          <div className="sidebar-shortcuts">
            <div className="shortcut-row">
              <span>Send message</span>
              <kbd>Enter</kbd>
            </div>
            <div className="shortcut-row">
              <span>New line</span>
              <kbd>Shift + Enter</kbd>
            </div>
          </div>
        </div>

        {/* ── Bottom: University credit ────────────────────────── */}
        <div className="sidebar-footer">
          <img
            className="sidebar-footer-logo"
            src="/logo_faculte.png"
            alt="Ibn Tofaïl University"
          />
          <div className="sidebar-footer-text">
            <span>Faculté des Sciences — Kénitra</span>
            <span>Ibn Tofaïl University</span>
          </div>
        </div>
      </aside>
    </>
  );
}
