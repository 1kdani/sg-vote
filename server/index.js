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
const { Server } = require("socket.io");
const io = new Server(server, {
  cors: {
    origin: "*",   // minden origin-t engedünk
    methods: ["GET", "POST"]
  }
});


app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, '../client/dist')));
app.get('*', (req, res) => {
  res.sendFile(path.resolve(__dirname, '../client/dist/index.html'));
});


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
  const userClass = db.prepare('SELECT name FROM classes WHERE id = ?').get(user.class_id)?.name;

  res.json({ token, name: user.name, class: userClass, votes_used: user.votes_used });
});


app.get('/api/classes', (req, res) => {
  const classes = db.prepare('SELECT id, name, room, theme FROM classes ORDER BY name').all();

  // Számoljuk a szavazatokat
  const counts = db.prepare('SELECT class_id, COUNT(*) as cnt FROM votes GROUP BY class_id').all();
  const map = new Map(counts.map(r => [r.class_id, r.cnt]));

  // Payload: minden osztályhoz legyen votes mező
  const payload = classes.map(c => ({
    ...c,
    votes: map.get(c.id) || 0  // ha nincs szavazat, 0
  }));

  res.json(payload);
});


// --- Protected voting endpoint ---
app.post('/api/vote', verifyTokenMiddleware, (req, res) => {
  const userId = req.user.id;
  const { classId, count = 1 } = req.body;

  if (!classId) return res.status(400).json({ error: 'Missing classId' });
  if (count < 1 || count > 5) return res.status(400).json({ error: 'Invalid count' });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(401).json({ error: 'No such user' });

  const targetClass = db.prepare('SELECT * FROM classes WHERE id = ?').get(classId);
  if (!targetClass) return res.status(400).json({ error: 'No such class' });

  // check remaining votes
  const remaining = 5 - user.votes_used;
  if (remaining <= 0) return res.status(403).json({ error: 'No remaining votes' });
  if (count > remaining) return res.status(400).json({ error: 'Not enough remaining votes' });

  // cannot vote for own class
  const userClassName = db.prepare('SELECT name FROM classes WHERE id = ?').get(user.class_id)?.name;
  if (userClassName === targetClass.name) return res.status(403).json({ error: 'Cannot vote for own class' });

  // insert votes atomically
  const insertVote = db.prepare('INSERT INTO votes (user_id, class_id) VALUES (?, ?)');
  const updateUser = db.prepare('UPDATE users SET votes_used = votes_used + ? WHERE id = ?');
  const trx = db.transaction((n) => {
    for (let i = 0; i < n; i++) insertVote.run(userId, classId);
    updateUser.run(n, userId);
  });

  try {
    trx(count);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'DB error' });
  }

  // return updated user
  const updatedUser = db.prepare('SELECT id, name, class_id, votes_used FROM users WHERE id = ?').get(userId);
  const updatedUserClass = db.prepare('SELECT name FROM classes WHERE id = ?').get(updatedUser.class_id)?.name;
  updatedUser.class = updatedUserClass;

  // emit updated standings
  const counts = db.prepare('SELECT class_id, COUNT(*) as cnt FROM votes GROUP BY class_id').all();
  const countsMap = {};
  counts.forEach(r => countsMap[r.class_id] = r.cnt);
  const classes = db.prepare('SELECT id, name, room, theme FROM classes ORDER BY name').all();
  const payload = classes.map(c => ({ ...c, votes: countsMap[c.id] || 0 }));
  io.emit('standings', payload);

  res.json({ ok: true, user: updatedUser });
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
  const user = db.prepare('SELECT id, name, class_id, votes_used FROM users WHERE id = ?').get(req.user.id);
  const userClass = db.prepare('SELECT name FROM classes WHERE id = ?').get(user.class_id)?.name;
  res.json({ ...user, class: userClass });
});

// --- socket.io connection ---
io.on("connection", (socket) => {
  console.log("Új kliens csatlakozott:", socket.id);

  socket.on("vote", (data) => {
    console.log("Vote event:", data);
    io.emit("voteUpdate", data);
  });

  socket.on("disconnect", () => {
    console.log("Kliens lecsatlakozott:", socket.id);
  });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`✅ Server listening on ${PORT}`);
});