require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const bcrypt = require('bcrypt');
const path = require('path');
const pool = require('./db');
const { generateToken, verifyTokenMiddleware } = require('./auth');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());

// --- Bejelentkezés ---
app.post('/api/login', async (req, res) => {
  const { name, password } = req.body;
  if (!name || !password) return res.status(400).json({ error: 'Nem adtál meg adatokat!' });

  const adminPassword = "Adm1n$2025!Vote";
  if (name === "Admin") {
    if (password !== adminPassword) {
      return res.status(401).json({ error: 'Hibás admin jelszó!' });
    }
    const adminUser = { id: 0, name: "Admin", is_admin: true };
    const token = generateToken(adminUser);
    return res.json({
      token,
      name: "Admin",
      class: null,
      votes_used: 0,
      is_admin: true
    });
  }

  const result = await pool.query('SELECT * FROM users WHERE name=$1', [name]);
  const user = result.rows[0];
  if (!user) return res.status(401).json({ error: 'Nincs ilyen felhasználó!' });

  const ok = bcrypt.compareSync(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Hibás jelszó!' });

  const token = generateToken({ id: user.id, name: user.name, is_admin: false });

  let userClassName = null;
  if (user.class_id) {
    const cls = await pool.query('SELECT name FROM classes WHERE id=$1', [user.class_id]);
    if (cls.rows[0]) userClassName = cls.rows[0].name;
  }

  res.json({
    token,
    name: user.name,
    class: userClassName,
    votes_used: user.votes_used,
    is_admin: false
  });
});

// --- Osztályok lekérése ---
app.get('/api/classes', async (req, res) => {
  const classesRes = await pool.query('SELECT id, name, room, theme FROM classes ORDER BY name');
  const votesRes = await pool.query('SELECT class_id, COUNT(*) as cnt FROM votes GROUP BY class_id');

  const map = new Map(votesRes.rows.map(r => [r.class_id, parseInt(r.cnt)]));
  const payload = classesRes.rows.map(c => ({ ...c, votes: map.get(c.id) || 0 }));

  res.json(payload);
});

// --- Szavazás ---
app.post('/api/vote', verifyTokenMiddleware, async (req, res) => {
  const userId = req.user.id;
  const targetClassId = req.body.classId;
  const count = Number(req.body.count) || 1;

  if (!targetClassId) return res.status(400).json({ error: 'Hiányzik az osztály azonosító!' });
  if (count < 1 || count > 5) return res.status(400).json({ error: 'Érvénytelen szavazat szám!' });

  const userRes = await pool.query('SELECT * FROM users WHERE id=$1', [userId]);
  const user = userRes.rows[0];
  if (!user) return res.status(401).json({ error: 'Nincs ilyen felhasználó!' });

  const targetRes = await pool.query('SELECT * FROM classes WHERE id=$1', [targetClassId]);
  const targetClass = targetRes.rows[0];
  if (!targetClass) return res.status(400).json({ error: 'Nincs ilyen osztály!' });

  let userClassName = null;
  if (user.class_id) {
    const cls = await pool.query('SELECT name FROM classes WHERE id=$1', [user.class_id]);
    if (cls.rows[0]) userClassName = cls.rows[0].name;
  }

  if (userClassName === targetClass.name) {
    return res.status(403).json({ error: 'Saját osztályodra nem szavazhatsz!' });
  }

  const remaining = 5 - user.votes_used;
  if (remaining <= 0) return res.status(403).json({ error: 'Nincs több szavazatod!' });
  if (count > remaining) return res.status(400).json({ error: 'Nincs elég szavazatod!' });

  try {
    await pool.query('BEGIN');

    for (let i = 0; i < count; i++) {
      await pool.query('INSERT INTO votes (user_id, class_id) VALUES ($1, $2)', [userId, targetClassId]);
    }

    await pool.query('UPDATE users SET votes_used = votes_used + $1 WHERE id=$2', [count, userId]);

    await pool.query('COMMIT');
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error(err);
    return res.status(500).json({ error: 'Adatbázis hiba!' });
  }

  const updatedUserRes = await pool.query(
    'SELECT id, name, class_id, votes_used FROM users WHERE id=$1',
    [userId]
  );
  const updatedUser = updatedUserRes.rows[0];

  let updatedClassName = null;
  if (updatedUser.class_id) {
    const cls = await pool.query('SELECT name FROM classes WHERE id=$1', [updatedUser.class_id]);
    if (cls.rows[0]) updatedClassName = cls.rows[0].name;
  }
  updatedUser.class = updatedClassName;

  const classesRes = await pool.query('SELECT id, name, room, theme FROM classes ORDER BY name');
  const countsRes = await pool.query('SELECT class_id, COUNT(*) as cnt FROM votes GROUP BY class_id');

  const countsMap = {};
  countsRes.rows.forEach(r => countsMap[r.class_id] = parseInt(r.cnt));
  const payload = classesRes.rows.map(c => ({ ...c, votes: countsMap[c.id] || 0 }));

  io.emit('standings', payload);

  res.json({ ok: true, user: updatedUser });
});

// --- Admin: új osztály hozzáadása ---
app.post('/api/admin/add-class', async (req, res) => {
  const { name, room, theme } = req.body;
  if (!name) return res.status(400).json({ error: 'Hiányzik az osztály neve!' });

  try {
    await pool.query(
      'INSERT INTO classes (name, room, theme) VALUES ($1, $2, $3) ON CONFLICT (name) DO NOTHING',
      [name, room || null, theme || null]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Adatbázis hiba!' });
  }
});

// --- Saját felhasználó lekérése ---
app.get('/api/me', verifyTokenMiddleware, async (req, res) => {
  const result = await pool.query(
    'SELECT id, name, class_id, votes_used FROM users WHERE id=$1',
    [req.user.id]
  );
  const user = result.rows[0];

  let className = null;
  if (user.class_id) {
    const cls = await pool.query('SELECT name FROM classes WHERE id=$1', [user.class_id]);
    if (cls.rows[0]) className = cls.rows[0].name;
  }

  res.json({ ...user, class: className });
});

app.get('/api/admin/stats', authMiddleware, async (req, res) => {
  if (!req.user.is_admin) return res.status(403).json({ error: 'Forbidden' });

  const classes = await db.query('SELECT id, name, votes FROM classes ORDER BY votes DESC');
  const totalVotes = await db.query('SELECT SUM(votes) AS total FROM classes');
  const activeUsers = await db.query('SELECT COUNT(*) FROM users WHERE last_seen > NOW() - interval \'5 minutes\'');

  res.json({
    top3: classes.rows.slice(0, 3),
    all: classes.rows,
    totalVotes: totalVotes.rows[0].total || 0,
    activeUsers: activeUsers.rows[0].count || 0
  });
});


// --- Statikus fájlok ---
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
