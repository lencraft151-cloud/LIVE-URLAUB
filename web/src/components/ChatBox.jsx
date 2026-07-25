import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { getSocket } from "../lib/socket";
import { useAuth } from "../context/AuthContext";

export default function ChatBox({ channel }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [viewers, setViewers] = useState(0);
  const [text, setText] = useState("");
  const [chatError, setChatError] = useState("");
  const listRef = useRef(null);

  useEffect(() => {
    const socket = getSocket();

    function onHistory(data) {
      if (data.channel !== channel) return;
      setMessages(data.messages);
    }
    function onMessage(data) {
      if (data.channel !== channel) return;
      setMessages((prev) => [...prev.slice(-199), data]);
    }
    function onViewers(data) {
      if (data.channel !== channel) return;
      setViewers(data.count);
    }
    function onChatError(data) {
      setChatError(data.error);
      setTimeout(() => setChatError(""), 4000);
    }
    function join() {
      setMessages([]);
      socket.emit("chat:join", { channel });
    }

    socket.on("chat:history", onHistory);
    socket.on("chat:message", onMessage);
    socket.on("chat:viewers", onViewers);
    socket.on("chat:error", onChatError);
    socket.on("connect", join);
    if (socket.connected) join();

    return () => {
      socket.emit("chat:leave");
      socket.off("chat:history", onHistory);
      socket.off("chat:message", onMessage);
      socket.off("chat:viewers", onViewers);
      socket.off("chat:error", onChatError);
      socket.off("connect", join);
    };
  }, [channel]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    getSocket().emit("chat:message", { text: trimmed });
    setText("");
  }

  return (
    <div className="chatbox">
      <div className="chatbox-header">
        <span>Live-Chat</span>
        <span className="viewers-count">{viewers} Zuschauer</span>
      </div>

      <div className="chatbox-messages" ref={listRef}>
        {messages.length === 0 && <p className="chat-empty">Noch keine Nachrichten. Sei der Erste!</p>}
        {messages.map((m, i) => (
          <div className="chat-message" key={`${m.createdAt}-${i}`}>
            <span className="chat-username">{m.username}</span>
            <span className="chat-text">{m.message}</span>
          </div>
        ))}
      </div>

      {chatError && <p className="chat-error">{chatError}</p>}

      {user ? (
        <form className="chatbox-form" onSubmit={handleSubmit}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Nachricht schreiben..."
            maxLength={300}
          />
          <button className="btn btn-primary" type="submit">
            Senden
          </button>
        </form>
      ) : (
        <p className="chat-login-hint">
          <Link to="/login">Anmelden</Link>, um am Chat teilzunehmen.
        </p>
      )}
    </div>
  );
}
