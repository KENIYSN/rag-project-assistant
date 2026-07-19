"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ChatBar from "./ChatBar";
import MessageList from "./MessageList";
import TeamFooter from "./TeamFooter";

const TIPS = [
  "What are the main types of NoSQL databases?",
  "Explain the CAP theorem",
  "How does sharding work in MongoDB?",
  "Difference between SQL and NoSQL?",
];

const API_URL = "/api/chat";

export default function ChatInterface() {
  const [messages, setMessages] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef(null);

  const hasMessages = messages.length > 0;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(
    async (question, file) => {
      if (!question.trim() || isStreaming) return;

      const userMsg = {
        id: Date.now(),
        role: "user",
        content: question.trim(),
        fileName: file ? file.name : null,
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
        let body = { question: question.trim() };

        if (file) {
          const text = await file.text();
          body.fileContent = text;
          body.fileName = file.name;
        }

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
    [isStreaming]
  );

  return (
    <div className="app">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="app-header">
        <img
          className="header-logo"
          src="/logo_faculte.png"
          alt="Ibn Tofaïl University — Faculté des Sciences"
        />
        <h1>Project RAG-ASSISTANT</h1>
      </div>

      {/* ── Center: tips + messages ────────────────────────────────────── */}
      <div className={`center-area${hasMessages ? " has-messages" : ""}`}>
        {!hasMessages && (
          <div className="tips-section">
            <p className="tips-label">Try asking</p>
            <div className="tips-grid">
              {TIPS.map((tip) => (
                <button
                  key={tip}
                  className="tip-chip"
                  onClick={() => sendMessage(tip, null)}
                  type="button"
                >
                  {tip}
                </button>
              ))}
            </div>
          </div>
        )}

        {hasMessages && (
          <MessageList messages={messages} endRef={messagesEndRef} />
        )}
      </div>

      {/* ── Chat bar ──────────────────────────────────────────────────── */}
      <div className={`chatbar-wrapper${hasMessages ? " bottom" : ""}`}>
        <ChatBar onSend={sendMessage} disabled={isStreaming} />
      </div>

      {/* ── Team footer ───────────────────────────────────────────────── */}
      <TeamFooter />
    </div>
  );
}
