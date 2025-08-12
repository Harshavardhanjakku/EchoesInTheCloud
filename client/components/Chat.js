// client/components/Chat.js
import { useEffect, useRef, useState } from 'react';

let socket = null; // module-scoped so it won't be recreated across renders when possible

export default function Chat() {
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const scrollRef = useRef();

  useEffect(() => {
    let mounted = true;

    async function setupSocket() {
      // dynamic import so it only runs on the client
      const { io } = await import('socket.io-client');

      const SERVER_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000';

      // create socket
      socket = io(SERVER_URL, {
        transports: ['websocket', 'polling']
      });

      socket.on('connect', () => {
        if (!mounted) return;
        setConnected(true);
        console.log('connected', socket.id);
      });

      socket.on('disconnect', () => {
        setConnected(false);
      });

      socket.on('message-history', (history) => {
        if (!mounted) return;
        setMessages(history || []);
      });

      socket.on('message', (msg) => {
        if (!mounted) return;
        setMessages((prev) => [...prev, msg]);
      });
    }

    setupSocket();

    return () => {
      mounted = false;
      if (socket) {
        socket.disconnect();
        socket = null;
      }
    };
  }, []);

  // auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  function sendMessage(e) {
    e.preventDefault();
    if (!text.trim()) return;

    const msg = {
      user: name || 'Anonymous',
      text: text.trim(),
      time: new Date().toISOString()
    };

    // emit to server
    if (socket && socket.connected) {
      socket.emit('message', msg);
    } else {
      // fallback: add locally
      setMessages((prev) => [...prev, { ...msg, id: Date.now() }]);
    }

    setText('');
  }

  return (
    <div className="chat-container">
      <header className="chat-header">
        <h1>Next.js + Socket.IO Chat</h1>
        <div className={`status ${connected ? 'online' : 'offline'}`}>
          {connected ? 'Online' : 'Offline'}
        </div>
      </header>

      <div className="chat-main">
        <aside className="chat-side">
          <label>
            <div className="label">Your name</div>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Type your name" />
          </label>
        </aside>

        <section className="chat-box" ref={scrollRef}>
          {messages.map((m) => (
            <article key={m.id || m.time} className="message">
              <div className="meta">
                <strong>{m.user}</strong>
                <span className="time">{new Date(m.time).toLocaleTimeString()}</span>
              </div>
              <div className="text">{m.text}</div>
            </article>
          ))}
        </section>
      </div>

      <form className="composer" onSubmit={sendMessage}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write a message and press Enter or click Send..."
        />
        <button type="submit">Send</button>
      </form>

      {/* small styles kept in globals.css - see file */}
    </div>
  );
}