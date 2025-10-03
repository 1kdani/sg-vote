-- users: minden diák
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  class INTEGER, -- lehet NULL
  password_hash TEXT NOT NULL,
  votes_used INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (class) REFERENCES classes(id)
);


-- classes: list of classes, room and theme
CREATE TABLE IF NOT EXISTS classes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  room TEXT,
  theme TEXT
);

-- votes: minden egyes leadott szavazatot naplózza
CREATE TABLE IF NOT EXISTS votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  class_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(class_id) REFERENCES classes(id)
);

-- index a gyors lekérdezéshez
CREATE INDEX IF NOT EXISTS idx_votes_class ON votes(class_id);
CREATE INDEX IF NOT EXISTS idx_votes_user ON votes(user_id);
