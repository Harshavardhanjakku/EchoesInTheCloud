const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const sanitizeHtml = require('sanitize-html');
require('dotenv').config();

const app = express();
if (!process.env.CLIENT_ORIGIN) {
  console.warn('⚠️ CLIENT_ORIGIN not set, defaulting to localhost');
}
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:3000',
  methods: ['GET', 'POST']
}));
app.use(express.json());

const PORT = process.env.PORT || 5000;

// --- MongoDB schema & model ---
const messageSchema = new mongoose.Schema(
  {
    user: { type: String, required: true },
    text: { type: String, required: true },
    time: { type: Date, default: Date.now }
  },
  { versionKey: false }
);
messageSchema.index({ time: 1 });
const Message = mongoose.model('Message', messageSchema);

// --- HTTP + Socket.IO server ---
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

// Store connected users in memory
let onlineUsers = new Map(); // socket.id -> username

io.on('connection', async (socket) => {
  console.log('⚡ Client connected:', socket.id);
  onlineUsers.set(socket.id, 'Anonymous');

  // Send message history
  try {
    const history = await Message.find().sort({ time: 1 }).limit(500);
    socket.emit('message-history', history);
  } catch (err) {
    console.error('❌ Error fetching message history:', err);
  }

  socket.on('set-username', (username) => {
    const cleanName = sanitizeHtml(username?.trim() || 'Anonymous', { allowedTags: [] });
    onlineUsers.set(socket.id, cleanName);
    io.emit('room-users', Array.from(onlineUsers.values()));
  });

  // Receive & save messages
  socket.on('message', async (msg) => {
    try {
      const username = sanitizeHtml((msg.user || 'Anonymous').trim() || 'Anonymous', { allowedTags: [] });
      onlineUsers.set(socket.id, username);

      const doc = await Message.create({
        user: username,
        text: sanitizeHtml(msg.text || '', { allowedTags: [] }),
        time: msg.time ? new Date(msg.time) : new Date()
      });

      io.emit('message', doc);
      io.emit('room-users', Array.from(onlineUsers.values()));
    } catch (err) {
      console.error('❌ Error saving message:', err);
    }
  });

  // Typing indicator
  socket.on('typing', (payload = {}) => {
    const who = sanitizeHtml((payload.user || 'Someone').trim() || 'Someone', { allowedTags: [] });
    onlineUsers.set(socket.id, who);
    socket.broadcast.emit('typing', { user: who, at: Date.now() });
    io.emit('room-users', Array.from(onlineUsers.values()));
  });

  // On disconnect
  socket.on('disconnect', (reason) => {
    console.log('❌ Client disconnected:', socket.id, 'reason:', reason);
    onlineUsers.delete(socket.id);
    io.emit('room-users', Array.from(onlineUsers.values()));
  });

  // Send current online list to the newly connected user
  socket.emit('room-users', Array.from(onlineUsers.values()));
});

// --- REST endpoint ---
app.get('/messages', async (req, res) => {
  try {
    const messages = await Message.find().sort({ time: 1 }).limit(500);
    res.json(messages);
  } catch (err) {
    console.error('❌ /messages error:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// --- Start server after DB connect ---
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    server.listen(PORT, () => {
      console.log(`🚀 Server listening on port ${PORT}`);
      console.log(`🔗 Allowed client origin: ${process.env.CLIENT_ORIGIN || 'http://localhost:3000'}`);
    });
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });