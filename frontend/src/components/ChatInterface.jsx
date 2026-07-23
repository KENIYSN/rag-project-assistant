"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ChatBar from "./ChatBar";
import MessageList from "./MessageList";
import Sidebar from "./Sidebar";

const TIPS = [
  "What are the main types of NoSQL databases?",
  "Explain the CAP theorem",
  "How does sharding work in MongoDB?",
  "Difference between SQL and NoSQL?",
];

const API_URL = "/api/chat";
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export default function ChatInterface() {
  const [messages, setMessages] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeSource, setActiveSource] = useState(null); // nom du PDF actuellement indexé
  const [isUploading, setIsUploading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const messagesEndRef = useRef(null);

  const hasMessages = messages.length > 0;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleNewChat = useCallback(() => {
    setMessages([]);
    setActiveSource(null);
    setIsStreaming(false);
    setIsUploading(false);
  }, []);

  const sendMessage = useCallback(
    async (question, file) => {
      if (!question.trim() || isStreaming || isUploading) return;

      // ── 1. Upload du PDF si un fichier est attaché ────────────────────────
      let currentSource = activeSource; // fichier déjà indexé de la session

      if (file && file.name.toLowerCase().endsWith(".pdf")) {
        setIsUploading(true);
        // Message système d'information
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() - 2,
            role: "system",
            content: `⏳ Indexation de **${file.name}** en cours…`,
          },
        ]);

        try {
          const formData = new FormData();
          formData.append("file", file);
          const uploadRes = await fetch(`${BACKEND_URL}/upload_course`, {
            method: "POST",
            body: formData,
          });

          if (!uploadRes.ok) {
            const err = await uploadRes.json().catch(() => ({}));
            throw new Error(err.detail || `Upload error (${uploadRes.status})`);
          }

          const uploadData = await uploadRes.json();
          currentSource = file.name;
          setActiveSource(currentSource);

          // Remplace le message d'attente par la confirmation
          setMessages((prev) =>
            prev.map((m) =>
              m.content?.includes("Indexation de") && m.role === "system"
                ? {
                    ...m,
                    content: `✅ **${uploadData.chunks_inserted} chunks** indexés depuis *${file.name}*. Tu peux maintenant poser tes questions !`,
                  }
                : m
            )
          );
        } catch (uploadError) {
          setMessages((prev) =>
            prev.map((m) =>
              m.content?.includes("Indexation de") && m.role === "system"
                ? {
                    ...m,
                    content: `❌ Erreur lors de l'upload : ${uploadError.message}`,
                    isError: true,
                  }
                : m
            )
          );
          setIsUploading(false);
          return; // on n'envoie pas la question si l'upload a échoué
        } finally {
          setIsUploading(false);
        }
      }

      // ── 2. Envoi de la question au LLM ────────────────────────────────
      const userMsg = {
        id: Date.now(),
        role: "user",
        content: question.trim(),
        fileName: file ? file.name : currentSource,
      };

      const assistantMsg = {
        id: Date.now() + 1,
        role: "assistant",
        content: "",
        sources: [],
        isStreaming: true,
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsStreaming(true);

      try {
        // On passe le fileName pour filtrer la recherche sur ce PDF
        const body = {
          question: question.trim(),
          fileName: currentSource || null,
        };

        const response = await fetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error || `Server error (${response.status})`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const data = line.replace(/^data: /, "").trim();
            if (!data) continue;

            try {
              const event = JSON.parse(data);

              if (event.type === "sources") {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsg.id
                      ? { ...m, sources: event.sources }
                      : m
                  )
                );
              } else if (event.type === "token") {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsg.id
                      ? { ...m, content: m.content + event.content }
                      : m
                  )
                );
              } else if (event.type === "done") {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsg.id
                      ? { ...m, isStreaming: false }
                      : m
                  )
                );
              } else if (event.type === "error") {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsg.id
                      ? {
                          ...m,
                          content: m.content + `\n\n⚠️ ${event.error}`,
                          isStreaming: false,
                        }
                      : m
                  )
                );
              }
            } catch {
              // skip malformed JSON
            }
          }
        }

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id ? { ...m, isStreaming: false } : m
          )
        );
      } catch (error) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id
              ? {
                  ...m,
                  content: `Something went wrong: ${error.message}`,
                  isStreaming: false,
                  isError: true,
                }
              : m
          )
        );
      } finally {
        setIsStreaming(false);
      }
    },
    [isStreaming, isUploading, activeSource]
  );

  return (
    <div className={`app${sidebarOpen ? " sidebar-active" : ""}`}>
      {/* ── Sidebar ───────────────────────────────────────────────────── */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onNewChat={handleNewChat}
        messageCount={messages.length}
      />

      {/* ── Main Content ──────────────────────────────────────────────── */}
      <div className="main-content">
        {/* ── Top bar ─────────────────────────────────────────────────── */}
        <div className="topbar">
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarOpen((prev) => !prev)}
            aria-label="Toggle sidebar"
            type="button"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="9" y1="3" x2="9" y2="21" />
            </svg>
          </button>
          <span className="topbar-title">RAG Assistant Showcase</span>
        </div>

        {/* ── Center: welcome / messages ──────────────────────────────── */}
        <div className={`center-area${hasMessages ? " has-messages" : ""}`}>
          {!hasMessages && (
            <div className="welcome-section">
              <img
                className="welcome-logo"
                src="/logo_faculte.png"
                alt="Ibn Tofaïl University — Faculté des Sciences"
              />
              <h1 className="welcome-heading">RAG Assistant Showcase</h1>
              <p className="welcome-sub">
                Upload a course PDF or ask anything about your materials
              </p>

              <div className="tips-grid">
                {TIPS.map((tip) => (
                  <button
                    key={tip}
                    className="tip-card"
                    onClick={() => sendMessage(tip, null)}
                    type="button"
                  >
                    <span className="tip-text">{tip}</span>
                    <span className="tip-arrow">→</span>
                  </button>
                ))}
              </div>

              <p className="welcome-disclaimer">
                Answers are generated from your uploaded documents only. Always verify critical information.
              </p>
            </div>
          )}

          {hasMessages && (
            <MessageList messages={messages} endRef={messagesEndRef} />
          )}
        </div>

        {/* ── Chat bar ──────────────────────────────────────────────────── */}
        <div className={`chatbar-wrapper${hasMessages ? " bottom" : ""}`}>
          {activeSource && (
            <div className="active-source-badge">
              <span>📚 Active source: <strong>{activeSource}</strong></span>
              <button
                onClick={() => setActiveSource(null)}
                title="Remove source filter"
                aria-label="Remove source filter"
              >✕</button>
            </div>
          )}
          <ChatBar onSend={sendMessage} disabled={isStreaming || isUploading} />
        </div>
      </div>
    </div>
  );
}
