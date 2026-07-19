"use client";

import { useState, useRef, useEffect } from "react";

function PaperclipIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

export default function ChatBar({ onSend, disabled }) {
  const [input, setInput] = useState("");
  const [file, setFile] = useState(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 140) + "px";
    }
  }, [input]);

  const handleSend = () => {
    if (!input.trim() || disabled) return;
    onSend(input, file);
    setInput("");
    setFile(null);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (selected) setFile(selected);
    e.target.value = "";
  };

  return (
    <div>
      {/* File chip */}
      {file && (
        <div className="file-chip">
          <span>📎 {file.name}</span>
          <button onClick={() => setFile(null)} aria-label="Remove file">✕</button>
        </div>
      )}

      <div className="chatbar">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt,.md,.csv,.json,.py,.js,.html,.css"
          onChange={handleFileChange}
          style={{ display: "none" }}
        />

        <button
          className="attach-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          aria-label="Attach file"
          type="button"
        >
          <PaperclipIcon />
        </button>

        <textarea
          ref={textareaRef}
          className="chatbar-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question about your course..."
          rows={1}
          disabled={disabled}
          aria-label="Type your question"
        />

        <button
          className="send-btn"
          onClick={handleSend}
          disabled={!input.trim() || disabled}
          aria-label="Send message"
          type="button"
        >
          <SendIcon />
        </button>
      </div>
    </div>
  );
}
