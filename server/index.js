require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const bcrypt = require('bcrypt');
const path = require('path'); // ← kell a statikus fájlokhoz
const db = require('./db');
const { generateToken, verifyTokenMiddleware } = require('./auth');

const app = express();
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());

// --- STATIC FILES (React build) ---
app.use(express.static(path.join(__dirname, '../client/build')));

// --- API ROUTES ---
// Init DB from migration file if empty
const fs = require('fs');
const migrations = fs.readFileSync(__dirname + '/migrations.sql', 'utf8');
db.exec(migrations);

// --- AUTH ---
app.post('/api/login', (req, res) => {
  const { name, password } = req.body;
  if (!name || !password) return res.status(400).json({ error: 'Missing' });
  const user = db.prepare('SELECT * FROM users WHERE name = ?').get(name);
  if (!user) return res.status(401).json({ error: 'No such user' });
  const ok = bcrypt.compareSync(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid creds' });
  const token = generateToken(user);
  res.json({ token, name: user.name, class: user.class, votes_used: user.votes_used });
});

app.get('/api/classes', (req, res) => {
  const classes = db.prepare('SELECT id, name, room, theme FROM classes ORDER BY name').all();
  const counts = db.prepare('SELECT class_id, COUNT(*) as cnt FROM votes GROUP BY class_id').all();
  const map = new Map(counts.map(r => [r.class_id, r.cnt]));
  const payload = classes.map(c => ({ ...c, votes: map.get(c.id) || 0 }));
  res.json(payload);
});

// --- Protected voting endpoint ---
app.post('/api/vote', verifyTokenMiddleware, (req, res) => {
  // ... ugyanaz a logika mint nálad ...
});

// --- admin endpoints ---
app.post('/api/admin/add-class', (req, res) => {
  const { name, room, theme } = req.body;
  if (!name) return res.status(400).json({ error: 'Missing name' });
  try {
    db.prepare('INSERT OR IGNORE INTO classes (name, room, theme) VALUES (?, ?, ?)').run(name, room || null, theme || null);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'DB error' }); }
});

app.get('/api/me', verifyTokenMiddleware, (req, res) => {
  const user = db.prepare('SELECT id, name, class, votes_used FROM users WHERE id = ?').get(req.user.id);
  res.json(user);
});

// --- socket.io connection ---
io.on('connection', (socket) => {
  console.log('socket connected', socket.id);
  const counts = db.prepare('SELECT class_id, COUNT(*) as cnt FROM votes GROUP BY class_id').all();
  const countsMap = {};
  counts.forEach(r => countsMap[r.class_id] = r.cnt);
  const classes = db.prepare('SELECT id, name, room, theme FROM classes ORDER BY name').all();
  const payload = classes.map(c => ({ ...c, votes: countsMap[c.id] || 0 }));
  socket.emit('standings', payload);
});

// --- CATCHALL ROUTE ---
// minden route-ot, ami nem /api-vel kezdődik, a React index.html-hez irányítunk
app.get('*', (req, res) => {
  res.sendFile(path.resolve(__dirname, '../client/build', 'index.html'));
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Server listening on ${PORT}`));
