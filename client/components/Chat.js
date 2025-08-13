// client/components/Chat.js
import { useEffect, useRef, useState } from 'react';

let socket = null; // module-scoped so it won't be recreated across renders when possible

export default function Chat() {
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const scrollRef = useRef();

  // NEW: ui/ux states
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [unseenCount, setUnseenCount] = useState(0);
  const [typingUsers, setTypingUsers] = useState(new Set()); // set of names typing
  const selfTypingTimeoutRef = useRef(null);

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
        // NEW: if user is not at bottom, increment unseen counter
        if (!isAtBottom) setUnseenCount((c) => c + 1);
      });

      // NEW: lightweight typing channel (no server change required; it just won’t show if server doesn’t emit)
      socket.on?.('typing', (payload = {}) => {
        if (!mounted) return;
        const who = (payload.user || 'Someone').trim();
        setTypingUsers((prev) => {
          const next = new Set(prev);
          next.add(who);
          return next;
        });
        // auto-clear typing after 2s silence
        setTimeout(() => {
          setTypingUsers((prev) => {
            const next = new Set(prev);
            next.delete(who);
            return next;
          });
        }, 2000);
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
  }, [isAtBottom]);

  // auto-scroll (only if user is near bottom)
  useEffect(() => {
    if (!scrollRef.current) return;
    if (isAtBottom) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      setUnseenCount(0);
    }
  }, [messages, isAtBottom]);

  // NEW: track scroll position to decide autoscroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleScroll = () => {
      const threshold = 60; // px tolerance from bottom
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
      setIsAtBottom(atBottom);
      if (atBottom) setUnseenCount(0);
    };

    el.addEventListener('scroll', handleScroll);
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  // NEW: emit typing when text changes, debounced
  useEffect(() => {
    if (!socket || !socket.connected) return;
    if (selfTypingTimeoutRef.current) clearTimeout(selfTypingTimeoutRef.current);

    if (text.trim().length > 0) {
      socket.emit?.('typing', { user: name || 'Anonymous' });
      // also add “self” locally (if server doesn’t echo)
      setTypingUsers((prev) => {
        const next = new Set(prev);
        next.add(name || 'You');
        return next;
      });
      selfTypingTimeoutRef.current = setTimeout(() => {
        setTypingUsers((prev) => {
          const next = new Set(prev);
          next.delete(name || 'You');
          return next;
        });
      }, 1200);
    }
  }, [text, name]);

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
    // scroll to bottom after send
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    });
  }

  // NEW: helper — initials avatar
  const initials = (str) =>
    (str || 'A')
      .split(' ')
      .map((s) => s[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

  // NEW: pretty time (HH:MM)
  const shortTime = (iso) => {
    try {
      return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div className="chat-shell">
      {/* Glassy backplate */}
      <div className="glass-bg" />

      <div className="chat-container">
        <header className="chat-header">
          <h1>My Chat App</h1>
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

            {/* NEW: small legend */}
            <div className="legend">
              <div className="legend-row">
                <span className="dot me" /> You
              </div>
              <div className="legend-row">
                <span className="dot other" /> Others
              </div>
            </div>
          </aside>

          <section className="chat-box" ref={scrollRef}>
            {/* NEW: empty state */}
            {messages.length === 0 && (
              <div className="empty-state">
                <div className="empty-bubble shimmer">No messages yet</div>
                <p className="empty-text">Say hello to start the conversation ✨</p>
              </div>
            )}

            {/* NEW: typing indicator bar */}
            {typingUsers.size > 0 && (
              <div className="typing-bar">
                <span className="typing-dots" aria-hidden>
                  <i />
                  <i />
                  <i />
                </span>
                <span className="typing-text">
                  {[...typingUsers].slice(0, 2).join(', ')}
                  {typingUsers.size > 2 ? ` +${typingUsers.size - 2}` : ''} typing…
                </span>
              </div>
            )}

            {messages.map((m) => {
              const mine = (m.user || 'Anonymous') === (name || 'Anonymous');
              return (
                <div
                  key={m.id || m.time}
                  className={`msg-row ${mine ? 'mine' : 'theirs'}`}
                >
                  {/* avatar bubble */}
                  <div className="avatar" aria-hidden>
                    {initials(m.user)}
                  </div>

                  {/* original markup preserved inside */}
                  <article className="message">
                    <div className="meta">
                      <strong>{m.user}</strong>
                      <span className="time">{shortTime(m.time)}</span>
                    </div>
                    <div className="text">{m.text}</div>
                  </article>
                </div>
              );
            })}
          </section>
        </div>

        {/* new messages pill when scrolled up */}
        {unseenCount > 0 && !isAtBottom && (
          <button
            className="new-msg-pill"
            onClick={() => {
              if (!scrollRef.current) return;
              scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
              setUnseenCount(0);
            }}
            aria-label="Jump to newest messages"
          >
            {unseenCount} new message{unseenCount > 1 ? 's' : ''}
          </button>
        )}

        <form className="composer" onSubmit={sendMessage}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write a message…  Press Enter to send, Shift+Enter for new line"
            onKeyDown={(e) => {
              // allow multiline with Shift+Enter
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage(e);
              }
            }}
          />
          <button type="submit">Send</button>
        </form>

        {/* small styles kept in globals.css - see file */}
      </div>
    </div>
  );
}
