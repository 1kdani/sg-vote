-- classes: list of classes, room and theme
CREATE TABLE IF NOT EXISTS classes (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  room TEXT,
  theme TEXT
);

-- users: minden diák
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  class_id INTEGER, -- lehet NULL
  password_hash TEXT NOT NULL,
  votes_used INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (class_id) REFERENCES classes(id)
);

-- votes: minden egyes leadott szavazatot naplózza
CREATE TABLE IF NOT EXISTS votes (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  class_id INTEGER NOT NULL REFERENCES classes(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- indexek a gyors lekérdezéshez
CREATE INDEX IF NOT EXISTS idx_votes_class ON votes(class_id);
CREATE INDEX IF NOT EXISTS idx_votes_user ON votes(user_id);
