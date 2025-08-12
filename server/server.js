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

// MongoDB schema & model
const messageSchema = new mongoose.Schema({
  user: { type: String, required: true },
  text: { type: String, required: true },
  time: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', messageSchema);

// HTTP + Socket.IO server
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_ORIGIN || '*',
    methods: ['GET', 'POST']
  }
});

// Socket.IO events
io.on('connection', async (socket) => {
  console.log('⚡ Client connected:', socket.id);

  try {
    const history = await Message.find().sort({ time: 1 }).limit(500);
    socket.emit('message-history', history);
  } catch (err) {
    console.error('❌ Error fetching message history:', err);
  }

  socket.on('message', async (msg) => {
    try {
      const message = await Message.create({
        user: msg.user || 'Anonymous',
        text: msg.text || '',
        time: msg.time ? new Date(msg.time) : new Date()
      });

      io.emit('message', message);
    } catch (err) {
      console.error('❌ Error saving message:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log('❌ Client disconnected:', socket.id);
  });
});

// REST endpoint
app.get('/messages', async (req, res) => {
  try {
    const messages = await Message.find().sort({ time: 1 }).limit(500);
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Start server only after DB connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    server.listen(PORT, () => {
      console.log(`🚀 Server listening on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });
