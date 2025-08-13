// client/components/Chat.js
import { useEffect, useRef, useState } from 'react';

let socket = null; // module-scoped to avoid re-creation across renders

export default function Chat() {
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [name, setName] = useState('');
  const [text, setText] = useState('');

  const scrollRef = useRef();

  // --- UI/UX states ---
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [unseenCount, setUnseenCount] = useState(0);

  // typing state: set of names currently typing (others only)
  const [typingUsers, setTypingUsers] = useState(new Set());
  // map of username -> timeoutId so we can clear/restart per user
  const typingTimersRef = useRef(new Map());

  // --- Setup Socket once ---
  useEffect(() => {
    let mounted = true;

    async function setupSocket() {
      const { io } = await import('socket.io-client');
      const SERVER_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000';

      console.log('[Chat] Initializing socket to', SERVER_URL);
      socket = io(SERVER_URL, { transports: ['websocket', 'polling'] });

      socket.on('connect', () => {
        if (!mounted) return;
        setConnected(true);
        console.log('[Chat] connected. socket.id =', socket.id);
      });

      socket.on('disconnect', (reason) => {
        if (!mounted) return;
        setConnected(false);
        console.log('[Chat] disconnected. reason =', reason);
      });

      socket.on('message-history', (history) => {
        if (!mounted) return;
        console.log('[Chat] message-history received. count =', history?.length || 0);
        setMessages(history || []);
        // after history, keep view at bottom
        requestAnimationFrame(() => {
          if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            setIsAtBottom(true);
            setUnseenCount(0);
          }
        });
      });

      socket.on('message', (msg) => {
        if (!mounted) return;
        console.log('[Chat] message event:', msg);
        setMessages((prev) => [...prev, msg]);

        // new message badge if user is not at bottom
        if (!isAtBottom) setUnseenCount((c) => c + 1);
      });

      socket.on('message-error', (payload) => {
        console.warn('[Chat] message-error:', payload);
      });

      // --- NEW: typing handler (others only) ---
      socket.on('typing', (payload = {}) => {
        if (!mounted) return;
        const who = (payload.user || 'Someone').trim() || 'Someone';

        // don't show yourself in typing list
        if (who === (name || 'Anonymous')) {
          // ignore self-echoing if any
          return;
        }

        console.log(`[Chat] typing from ${who}`);
socket.on('typing', (username) => {
  if (username !== name) {
    console.log(`[Chat] Received typing from ${username}`);
    setTypingUsers((prev) => {
      const updated = new Set(prev);
      updated.add(username);
      return updated;
    });

    clearTimeout(typingTimeoutRef.current[username]);
    typingTimeoutRef.current[username] = setTimeout(() => {
      setTypingUsers((prev) => {
        const updated = new Set(prev);
        updated.delete(username);
        return updated;
      });
    }, 2000);
  }
});

        // add to set
        setTypingUsers((prev) => {
          const next = new Set(prev);
          next.add(who);
          return next;
        });

        // reset/extend their timer to clear after 2s
        const timers = typingTimersRef.current;
        if (timers.has(who)) {
          clearTimeout(timers.get(who));
        }
        const t = setTimeout(() => {
          setTypingUsers((prev) => {
            const next = new Set(prev);
            next.delete(who);
            return next;
          });
          timers.delete(who);
          console.log(`[Chat] typing cleared for ${who}`);
        }, 2000);
        timers.set(who, t);
      });
    }

    setupSocket();

    return () => {
      mounted = false;
      console.log('[Chat] cleanup: disconnecting socket');
      try {
        if (socket) {
          socket.removeAllListeners?.();
          socket.disconnect();
        }
      } catch (e) {
        console.warn('[Chat] error during disconnect:', e);
      } finally {
        socket = null;
      }
      // clear any outstanding typing timers
      for (const [, timer] of typingTimersRef.current) clearTimeout(timer);
      typingTimersRef.current.clear();
    };
  }, []); // VERY IMPORTANT: empty deps -> do NOT recreate socket on scroll or other state changes

  // --- Auto-scroll if at bottom ---
  useEffect(() => {
    if (!scrollRef.current) return;
    if (isAtBottom) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      setUnseenCount(0);
    }
  }, [messages, isAtBottom]);

  // --- Track scroll position ---
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleScroll = () => {
      const threshold = 60; // px tolerance from bottom
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
      if (atBottom !== isAtBottom) {
        setIsAtBottom(atBottom);
      }
      if (atBottom) setUnseenCount(0);
    };

    el.addEventListener('scroll', handleScroll);
    return () => el.removeEventListener('scroll', handleScroll);
  }, [isAtBottom]);

  // --- Emit typing on text changes (debounced by user speed & server clears after 2s) ---
  useEffect(() => {
    if (!socket || !socket.connected) return;
    if (text.trim().length === 0) return;

    const who = name?.trim() || 'Anonymous';
    // fire-and-forget lightweight typing ping
    socket.emit?.('typing', { user: who });
    console.log('[Chat] emit typing as', who);

    // We intentionally do NOT add ourselves to typingUsers, because UI must show others only.
  }, [text, name]);

  function sendMessage(e) {
    e.preventDefault();
    if (!text.trim()) return;

    const msg = {
      user: name?.trim() || 'Anonymous',
      text: text.trim(),
      time: new Date().toISOString()
    };

    console.log('[Chat] sending message:', msg);

    if (socket && socket.connected) {
      socket.emit('message', msg);
      console.log('[Chat] message emitted to server');
    } else {
      // offline fallback: show locally so user sees it; will not sync
      console.warn('[Chat] socket not connected, appending message locally (fallback)');
      setMessages((prev) => [...prev, { ...msg, _id: `local-${Date.now()}` }]);
    }

    setText('');

    // keep view at bottom
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    });
  }

  // helper — initials avatar
  const initials = (str) =>
    (str || 'A')
      .split(' ')
      .map((s) => s[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

  // helper — pretty time (HH:MM)
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
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Type your name"
              />
            </label>

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
            {messages.length === 0 && (
              <div className="empty-state">
                <div className="empty-bubble shimmer">No messages yet</div>
                <p className="empty-text">Say hello to start the conversation ✨</p>
              </div>
            )}

            {/* Typing indicator (others only) */}
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
              const username = m.user || 'Anonymous';
              const mine = username === (name?.trim() || 'Anonymous');
              const key = m._id || m.id || m.time || `${username}-${Math.random()}`;
              return (
                <div key={key} className={`msg-row ${mine ? 'mine' : 'theirs'}`}>
                  <div className="avatar" aria-hidden>
                    {initials(username)}
                  </div>

                  <article className="message">
                    <div className="meta">
                      <strong>{username}</strong>
                      <span className="time">{shortTime(m.time)}</span>
                    </div>
                    <div className="text">{m.text}</div>
                  </article>
                </div>
              );
            })}
          </section>
        </div>

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
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write a message…  Press Enter to send, Shift+Enter for new line"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage(e);
              }
            }}
            rows={1}
          />
          <button type="submit">Send</button>
        </form>

        {/* small styles kept in globals.css */}
      </div>
    </div>
  );
}
