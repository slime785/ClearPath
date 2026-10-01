const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

io.on('connection', (socket) => {
  console.log('a user connected:', socket.id);

  socket.on('chat message', (msg) => {
    const trimmed = msg.trim();
    if (!trimmed) {
      return; //ignores the empty messages
    }
    const payload = { senderId: socket.id, text: trimmed };
    console.log('broadcasting:', payload);
    io.emit('chat message', payload);
  });

  socket.on('disconnect', () => {
    console.log('user disconnected:', socket.id);
  });
});

server.listen(3000, () => {
  console.log('listening on http://localhost:3000');
});