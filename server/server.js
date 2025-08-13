// server/server.js
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || '*',
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
    origin: process.env.CLIENT_ORIGIN || '*',
    methods: ['GET', 'POST']
  }
});

// --- Socket.IO events ---
io.on('connection', async (socket) => {
  console.log('⚡ Client connected:', socket.id);

  try {
    const history = await Message.find().sort({ time: 1 }).limit(500);
    console.log(`📦 Sending ${history.length} messages to`, socket.id);
    socket.emit('message-history', history);
  } catch (err) {
    console.error('❌ Error fetching message history:', err);
  }

  // Receive chat messages from a client
  socket.on('message', async (msg) => {
    console.log('📥 message received from', socket.id, '->', msg);
    try {
      const doc = await Message.create({
        user: (msg.user || 'Anonymous').trim() || 'Anonymous',
        text: (msg.text || '').toString(),
        time: msg.time ? new Date(msg.time) : new Date()
      });

      console.log('💾 message saved with _id:', doc._id?.toString());
      io.emit('message', doc); // broadcast to everyone (including sender)
      console.log('📤 message broadcasted to all clients');
    } catch (err) {
      console.error('❌ Error saving message:', err);
      socket.emit('message-error', { error: 'Failed to save message' });
    }
  });

  // --- NEW: typing indicator handling ---
  // Client emits: socket.emit('typing', { user: 'Alice' })
  // We broadcast to others only; the typer never sees their own "is typing..."
  socket.on('typing', (payload = {}) => {
    const who = (payload.user || 'Someone').toString().trim() || 'Someone';
    console.log(`⌨️  typing event from ${socket.id} (${who})`);
    socket.broadcast.emit('typing', { user: who, at: Date.now() });
    console.log(`🛰️  typing event broadcasted to others (not to ${who})`);
  });
socket.on('typing', (username) => {
  console.log(`[Server] Typing event from: ${username}`);
  socket.broadcast.emit('typing', username);
});

  socket.on('disconnect', (reason) => {
    console.log('❌ Client disconnected:', socket.id, 'reason:', reason);
  });
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
      console.log(`🔗 Allowed client origin: ${process.env.CLIENT_ORIGIN || '*'}`);
    });
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });
