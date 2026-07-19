import MessageBubble from "./MessageBubble";

export default function MessageList({ messages, endRef }) {
  return (
    <div className="messages-list" role="log" aria-live="polite">
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
      <div ref={endRef} />
    </div>
  );
}
