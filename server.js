const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const db = require('./firebase');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

io.on('connection', (socket) => {
  console.log('a user connected:', socket.id);

  socket.on('chat message', async (data) => {
    const username = data.username.trim();
    const trimmed = data.text.trim();

    if(!username || !trimmed) {
      return;
    }

    
    const payload = { senderId: data.senderId, username: username, text: trimmed };
    console.log('broadcasting:', payload);
    io.emit('chat message', payload);

    try {
      await db.collection('messages').add({
        senderId: payload.senderId,
        username: payload.username,
        text: payload.text,
        timestamp: new Date()
      })

      console.log('Message saved');
    
    } catch (error) {
      console.error('Database write failure:', error);
    }

  });

  socket.on('disconnect', () => {
    console.log('user disconnected:', socket.id);
  });
});

server.listen(3000, () => {
  console.log('listening on http://localhost:3000');
});