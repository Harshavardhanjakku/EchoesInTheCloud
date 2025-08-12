# Next.js + Socket.IO Chat App — Full Project Files

This document contains a complete, **from-scratch** project scaffold (server + Next.js client) with every file's full code so you can run it **without errors**. We'll move step-by-step — you said you'll give updates, so when you want to run a step, tell me and I'll walk you through commands and debugging.

---

## Project overview

* **Server**: Node.js + Express + Socket.IO (port `5000` by default)
* **Client**: Next.js (pages dir) + socket.io-client (port `3000` in dev)
* **Communication**: Socket.IO events (`message`, `message-history`)
* **Persistence**: In-memory message history (simple and reliable for demo). You can swap in MongoDB/Redis later.
* **Deployment**: Docker + `docker-compose` included, plus notes for hosting on Render / Vercel.

---

## Folder tree

```
chat-app/
├── client/                     # Next.js frontend
│   ├── package.json
│   ├── pages/
│   │   ├── _app.js
│   │   └── index.js
│   ├── components/
│   │   └── Chat.js
│   ├── styles/
│   │   └── globals.css
│   ├── .env.local.example
│   └── Dockerfile
│
├── server/                     # Express + Socket.IO backend
│   ├── package.json
│   ├── server.js
│   ├── .env.example
│   └── Dockerfile
│
├── docker-compose.yml
└── README.md
```

---

### 1) `server/package.json`

```json
{
  "name": "chat-server",
  "version": "1.0.0",
  "description": "Express + Socket.IO chat server",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "dotenv": "^16.0.3",
    "express": "^4.18.2",
    "socket.io": "^4.7.2"
  },
  "devDependencies": {
    "nodemon": "^2.0.22"
  }
}
```

---

### 2) `server/server.js`

```js
// server/server.js
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_ORIGIN || '*',
    methods: ['GET', 'POST']
  }
});

// In-memory store for demo purposes
let messages = [];

io.on('connection', (socket) => {
  console.log('Client connected', socket.id);

  // Send full history to the connecting client
  socket.emit('message-history', messages);

  // When any client sends a message
  socket.on('message', (msg) => {
    // Add a server-side id & timestamp for consistency
    const message = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      user: msg.user || 'Anonymous',
      text: msg.text || '',
      time: msg.time || new Date().toISOString()
    };

    messages.push(message);

    // Keep the history size reasonable (e.g., last 500 messages)
    if (messages.length > 500) messages.shift();

    // Broadcast to everyone
    io.emit('message', message);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected', socket.id);
  });
});

app.get('/messages', (req, res) => {
  res.json(messages);
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
```

---

### 3) `server/.env.example`

```
PORT=5000
CLIENT_ORIGIN=http://localhost:3000
```

---

### 4) `server/Dockerfile`

```dockerfile
# server/Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["node", "server.js"]
```

---

### 5) `client/package.json`

```json
{
  "name": "chat-client",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3000",
    "build": "next build",
    "start": "next start -p 3000"
  },
  "dependencies": {
    "next": "^13.4.7",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "socket.io-client": "^4.7.2"
  }
}
```

> NOTE: Versions chosen are commonly stable; `npm install` will pick exact semver ranges.

---

### 6) `client/.env.local.example`

```
# URL of the backend Socket.IO server (change in production to your deployed server)
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
```

---

### 7) `client/pages/_app.js`

```js
// client/pages/_app.js
import '../styles/globals.css';

export default function MyApp({ Component, pageProps }) {
  return <Component {...pageProps} />;
}
```

---

### 8) `client/pages/index.js`

```js
// client/pages/index.js
import dynamic from 'next/dynamic';

// Chat uses socket.io-client and must run only on the client.
const Chat = dynamic(() => import('../components/Chat'), { ssr: false });

export default function Home() {
  return (
    <main>
      <Chat />
    </main>
  );
}
```

---

### 9) `client/components/Chat.js`

```js
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
```

---

### 10) `client/styles/globals.css`

```css
/* client/styles/globals.css */
:root {
  --bg: #f6f9fc;
  --card: #ffffff;
  --muted: #6b7280;
  --accent: #111827;
}

html,body,#__next {
  height: 100%;
}

body {
  margin: 0;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial;
  background: var(--bg);
  color: var(--accent);
}

.chat-container {
  max-width: 1000px;
  height: 88vh;
  margin: 28px auto;
  background: var(--card);
  border-radius: 12px;
  box-shadow: 0 8px 30px rgba(17, 24, 39, 0.08);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #eef2f7;
}

.chat-main {
  display: flex;
  flex: 1;
  gap: 12px;
}

.chat-side {
  width: 220px;
  padding: 12px;
  border-right: 1px solid #eef2f7;
}

.chat-side input {
  width: 100%;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid #e6edf3;
}

.chat-box {
  flex: 1;
  padding: 16px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.message {
  background: #f3f6fb;
  padding: 10px 12px;
  border-radius: 8px;
  max-width: 80%;
}

.message .meta {
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 12px;
  color: var(--muted);
  margin-bottom: 6px;
}

.composer {
  display: flex;
  gap: 8px;
  padding: 12px;
  border-top: 1px solid #eef2f7;
}

.composer input {
  flex: 1;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid #e6edf3;
}

.composer button {
  padding: 10px 16px;
  border-radius: 10px;
  border: none;
  background: #111827;
  color: white;
  cursor: pointer;
}

.status.online { color: green; }
.status.offline { color: #9ca3af; }

@media (max-width: 720px) {
  .chat-main { flex-direction: column; }
  .chat-side { width: 100%; border-right: none; border-bottom: 1px solid #eef2f7; }
}
```

---

### 11) `client/Dockerfile`

```dockerfile
# client/Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3000
ENV NODE_ENV=production
CMD ["npm", "start"]
```

---

### 12) `docker-compose.yml` (root)

```yaml
version: '3.8'
services:
  server:
    build: ./server
    ports:
      - "5000:5000"
    environment:
      - PORT=5000
      - CLIENT_ORIGIN=http://localhost:3000

  client:
    build: ./client
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_SOCKET_URL=http://server:5000
    depends_on:
      - server
```

> Note: In the compose network the `client` can reach the `server` by the service name `server` (hence `http://server:5000`). When using your browser to point to the client, it talks to the container's exposed port `3000`.

---

### 13) `README.md` (top-level quickstart)

````md
# Next.js + Socket.IO Chat App (monorepo)

## Local development (without Docker)

1. Start the server in one terminal:

```bash
cd server
npm install
cp .env.example .env    # edit if needed
npm run dev
````

2. Start the Next.js client in another terminal:

```bash
cd client
npm install
cp .env.local.example .env.local  # edit if needed (NEXT_PUBLIC_SOCKET_URL)
npm run dev
```

3. Open `http://localhost:3000` in your browser.

## Using Docker (single command)

```bash
# from project root
docker-compose up --build
```

This will expose the frontend on [http://localhost:3000](http://localhost:3000) and the backend on [http://localhost:5000](http://localhost:5000).

## Deploying

* **Frontend** (Next.js): Vercel or Netlify (Vercel recommended for Next.js). Set `NEXT_PUBLIC_SOCKET_URL` to your backend URL in environment variables.
* **Backend**: Render, Railway, Heroku, or a VPS. Make sure to allow CORS from your frontend domain.

When using separate hosts, set the backend's `CLIENT_ORIGIN` and the frontend's `NEXT_PUBLIC_SOCKET_URL` appropriately.

```

---

## What's next?

Tell me which step you'd like to start with and I'll walk you through it **step-by-step** — for example:

1. Create and run the **server** locally (I'll paste exact shell commands and help debug).
2. Create and run the **Next.js client** locally and connect to the server.
3. Dockerize and run using `docker-compose`.
4. Deploy the backend to Render/Railway and frontend to Vercel and configure env vars.

Say which step (1–4) you want to do now, or tell me if you'd like me to run through step 1 automatically.

---

*I didn't include any external credentials or secrets. Replace `.env` values with your own when deploying.*

```
