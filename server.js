const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const db = require('./firebase');
const scripts = require('./public/scripts.json');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

async function sendHistory(socket) {
  try {
    const snap = await db.collection('messages').orderBy('timestamp', 'desc').limit(50).get();
    const history = snap.docs
      .map(d => d.data())
      .reverse()
      .map(m => ({ senderId: m.senderId, text: m.text }));
    socket.emit('history', history);
  } catch (error) {
    console.error('History load failure:', error);
  }
}

io.on('connection', (socket) => {
  console.log('a user connected:', socket.id);

  socket.on('chat message', async (data) => {
    if (!data || typeof data.category !== 'string' || !Number.isInteger(data.index) || !Array.isArray(data.blanks)) return;

    const template = scripts[data.category] && scripts[data.category][data.index];
    if (typeof template !== 'string') return;

    const slots = template.match(/\[[^\]]+\]/g) || [];
    if (data.blanks.length !== slots.length) return;

    let i = 0;
    let valid = true;
    const text = template.replace(/\[[^\]]+\]/g, () => {
      const v = data.blanks[i++];
      if (typeof v !== 'string' || !v.trim() || v.length > 40) {
        valid = false;
        return '';
      }
      return v.trim();
    });
    if (!valid) return;

    const payload = { senderId: data.senderId, text };
    console.log('broadcasting:', payload);
    io.emit('chat message', payload);

    try {
      await db.collection('messages').add({
        senderId: data.senderId,
        text: text,
        category: data.category,
        index: data.index,
        blanks: data.blanks,
        timestamp: new Date()
      });
      console.log('Message saved');
    } catch (error) {
      console.error('Database write failure:', error);
    }
  });

  socket.on('disconnect', () => {
    console.log('user disconnected:', socket.id);
  });

  sendHistory(socket);
});

server.listen(3000, () => {
  console.log('listening on http://localhost:3000');
});