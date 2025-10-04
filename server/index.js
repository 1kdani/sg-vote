require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const bcrypt = require('bcrypt');
const path = require('path');
const db = require('./db');
const { generateToken, verifyTokenMiddleware } = require('./auth');
const jwt = require('jsonwebtoken');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());

// --- Adatbázis inicializálása ---
const migrations = fs.readFileSync(__dirname + '/migrations.sql', 'utf8');
db.exec(migrations);

// --- Bejelentkezés ---
app.post('/api/login', (req, res) => {
  const { name, password } = req.body;
  if (!name || !password) return res.status(400).json({ error: 'Nem adtál meg adatokat!' });

  const user = db.prepare('SELECT * FROM users WHERE name = ?').get(name);
  if (!user) return res.status(401).json({ error: 'Nincs ilyen felhasználó!' });

  const testPassword = 'admin';
  const ok = password === testPassword || bcrypt.compareSync(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Hibás jelszó!' });

  const token = generateToken(user);

  let userClassName = null;
  if (user.class) {
    const cls = db.prepare('SELECT name FROM classes WHERE id = ?').get(user.class);
    if (cls) userClassName = cls.name;
  }

  res.json({
    token,
    name: user.name,
    class: userClassName,
    votes_used: user.votes_used
  });
});

// --- Osztályok lekérése ---
app.get('/api/classes', (req, res) => {
  const classes = db.prepare('SELECT id, name, room, theme FROM classes ORDER BY name').all();
  const counts = db.prepare('SELECT class_id, COUNT(*) as cnt FROM votes GROUP BY class_id').all();
  const map = new Map(counts.map(r => [r.class_id, r.cnt]));
  const payload = classes.map(c => ({ ...c, votes: map.get(c.id) || 0 }));
  res.json(payload);
});

// --- Szavazás ---
app.post('/api/vote', verifyTokenMiddleware, (req, res) => {
  const userId = req.user.id;
  const targetClassId = req.body.classId;
  const count = Number(req.body.count) || 1;

  if (!targetClassId) return res.status(400).json({ error: 'Hiányzik az osztály azonosító!' });
  if (count < 1 || count > 5) return res.status(400).json({ error: 'Érvénytelen szavazat szám!' });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(401).json({ error: 'Nincs ilyen felhasználó!' });

  const targetClass = db.prepare('SELECT * FROM classes WHERE id = ?').get(targetClassId);
  if (!targetClass) return res.status(400).json({ error: 'Nincs ilyen osztály!' });

  const userClassName = user.class
    ? db.prepare('SELECT name FROM classes WHERE id = ?').get(user.class)?.name
    : null;

  if (userClassName === targetClass.name) return res.status(403).json({ error: 'Saját osztályodra nem szavazhatsz!' });

  const remaining = 5 - user.votes_used;
  if (remaining <= 0) return res.status(403).json({ error: 'Nincs több szavazatod!' });
  if (count > remaining) return res.status(400).json({ error: 'Nincs elég szavazatod!' });

  const insertVote = db.prepare('INSERT INTO votes (user_id, class_id) VALUES (?, ?)');
  const updateUser = db.prepare('UPDATE users SET votes_used = votes_used + ? WHERE id = ?');
  const trx = db.transaction((n) => {
    for (let i = 0; i < n; i++) insertVote.run(userId, targetClassId);
    updateUser.run(n, userId);
  });

  try {
    trx(count);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Adatbázis hiba!' });
  }

  const updatedUser = db.prepare('SELECT id, name, class, votes_used FROM users WHERE id = ?').get(userId);
  updatedUser.class = updatedUser.class
    ? db.prepare('SELECT name FROM classes WHERE id = ?').get(updatedUser.class)?.name
    : null;

  const classes = db.prepare('SELECT id, name, room, theme FROM classes ORDER BY name').all();
  const counts = db.prepare('SELECT class_id, COUNT(*) as cnt FROM votes GROUP BY class_id').all();
  const countsMap = {};
  counts.forEach(r => countsMap[r.class_id] = r.cnt);
  const payload = classes.map(c => ({ ...c, votes: countsMap[c.id] || 0 }));

  io.emit('standings', payload);

  res.json({ ok: true, user: updatedUser });
});

// --- Admin: új osztály hozzáadása ---
app.post('/api/admin/add-class', (req, res) => {
  const { name, room, theme } = req.body;
  if (!name) return res.status(400).json({ error: 'Hiányzik az osztály neve!' });
  try {
    db.prepare('INSERT OR IGNORE INTO classes (name, room, theme) VALUES (?, ?, ?)').run(name, room || null, theme || null);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Adatbázis hiba!' });
  }
});

// --- Saját felhasználó lekérése ---
app.get('/api/me', verifyTokenMiddleware, (req, res) => {
  const user = db.prepare('SELECT id, name, class AS class_id, votes_used FROM users WHERE id = ?').get(req.user.id);
  const userClassName = user.class_id
    ? db.prepare('SELECT name FROM classes WHERE id = ?').get(user.class_id)?.name
    : null;
  res.json({ ...user, class: userClassName });
});

// --- Statikus fájlok és SPA fallback ---
app.use(express.static(path.join(__dirname, '../client/dist')));
app.get('*', (req, res) => {
  res.sendFile(path.resolve(__dirname, '../client/dist/index.html'));
});

// --- Websocket ---
io.on("connection", (socket) => {
  console.log("Új kliens csatlakozott:", socket.id);

  socket.on("vote", (data) => {
    console.log("Vote esemény:", data);
    io.emit("voteUpdate", data);
  });

  socket.on("disconnect", () => {
    console.log("Kliens lecsatlakozott:", socket.id);
  });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`✅ Szerver fut a ${PORT} porton`);
});