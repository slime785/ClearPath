const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const db = require('./firebase');
const scripts = require('./public/scripts.json');
const { getAuth } = require('firebase-admin/auth');
const { FieldValue } = require('firebase-admin/firestore');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// On bender, NGINX removes /clearpath-26/api/ before the request reaches
// this server, so the routes have to work with and without the /api prefix.
const api = express.Router();
app.use('/api', api);
app.use('/', api);

api.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

api.post('/signup', async (req, res) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'not logged in' });

  let decoded;
  try {
    decoded = await getAuth().verifyIdToken(token);
  } catch (error) {
    return res.status(401).json({ error: 'not logged in' });
  }

  try {
    await db.collection('users').doc(decoded.uid).create({
      email: decoded.email || null,
      role: 'parent',
      caseId: null,
      createdAt: FieldValue.serverTimestamp()
    });
    res.status(201).json({ ok: true });
  } catch (error) {
    if (error.code === 6) return res.status(409).json({ error: 'already exists' });
    console.error('Signup failure:', error);
    res.status(500).json({ error: 'server error' });
  }
});

api.get('/me', async (req, res) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'not logged in' });

  let decoded;
  try {
    decoded = await getAuth().verifyIdToken(token);
  } catch (error) {
    return res.status(401).json({ error: 'not logged in' });
  }

  try {
    const doc = await db.collection('users').doc(decoded.uid).get();
    res.json({ role: doc.exists ? (doc.get('role') || null) : null });
  } catch (error) {
    console.error('Me failure:', error);
    res.status(500).json({ error: 'server error' });
  }
});

async function requireAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'not logged in' });

  let decoded;
  try {
    decoded = await getAuth().verifyIdToken(token);
  } catch (error) {
    return res.status(401).json({ error: 'not logged in' });
  }

  try {
    const userDoc = await db.collection('users').doc(decoded.uid).get();
    if (!userDoc.exists || userDoc.get('role') !== 'admin') {
      return res.status(403).json({ error: 'not an admin' });
    }
    req.userId = decoded.uid;
    next();
  } catch (error) {
    console.error('Admin check failure:', error);
    res.status(500).json({ error: 'server error' });
  }
}

api.use('/admin', express.json());

api.get('/admin/users', requireAdmin, async (req, res) => {
  try {
    const snap = await db.collection('users').get();
    res.json(snap.docs.map(d => ({
      uid: d.id,
      email: d.get('email') || null,
      role: d.get('role') || null,
      caseId: d.get('caseId') || null
    })));
  } catch (error) {
    console.error('Admin list failure:', error);
    res.status(500).json({ error: 'server error' });
  }
});

api.post('/admin/assign', requireAdmin, async (req, res) => {
  const { uid, caseId } = req.body || {};
  if (typeof uid !== 'string' || !uid) {
    return res.status(400).json({ error: 'bad uid' });
  }
  if (caseId !== null && !(typeof caseId === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(caseId))) {
    return res.status(400).json({ error: 'bad caseId' });
  }
  try {
    const ref = db.collection('users').doc(uid);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'no such user' });
    await ref.update({ caseId });
    res.json({ ok: true });
  } catch (error) {
    console.error('Admin assign failure:', error);
    res.status(500).json({ error: 'server error' });
  }
});

async function sendHistory(socket) {
  try {
    const snap = await db.collection('messages')
      .where('caseId', '==', socket.caseId)
      .orderBy('timestamp', 'desc')
      .limit(50)
      .get();
    const history = snap.docs
      .map(d => d.data())
      .reverse()
      .map(m => ({ senderId: m.senderId, text: m.text }));
    socket.emit('history', history);
  } catch (error) {
    console.error('History load failure:', error);
  }
}

io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  if (typeof token !== 'string' || !token) {
    return next(new Error('not logged in'));
  }
  let decoded;
  try {
    decoded = await getAuth().verifyIdToken(token);
  } catch (error) {
    return next(new Error('not logged in'));
  }
  try {
    const userDoc = await db.collection('users').doc(decoded.uid).get();
    const caseId = userDoc.exists ? userDoc.get('caseId') : null;
    if (typeof caseId !== 'string' || !caseId) {
      return next(new Error('no case'));
    }
    socket.userId = decoded.uid;
    socket.caseId = caseId;
    next();
  } catch (error) {
    console.error('User lookup failure:', error);
    next(new Error('no case'));
  }
});

io.on('connection', (socket) => {
  console.log('a user connected:', socket.id, 'case:', socket.caseId);
  socket.join(socket.caseId);
  socket.join('user:' + socket.userId);

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

    const payload = { senderId: socket.userId, text };
    console.log('broadcasting to', socket.caseId, payload);
    io.to(socket.caseId).emit('chat message', payload);

    try {
      await db.collection('messages').add({
        senderId: socket.userId,
        caseId: socket.caseId,
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

const lastCase = new Map();

db.collection('users').onSnapshot(snap => {
  snap.docChanges().forEach(change => {
    const uid = change.doc.id;
    const caseId = change.type === 'removed' ? null : (change.doc.get('caseId') || null);
    if (lastCase.has(uid) && lastCase.get(uid) !== caseId) {
      io.in('user:' + uid).disconnectSockets();
    }
    lastCase.set(uid, caseId);
  });
}, error => {
  console.error('users listener failed:', error);
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log('listening on port ' + port);
});