const fs = require('fs');
const { parse } = require('csv-parse/sync');
const db = require('./db');

const csvFile = './classes.csv';
if (!fs.existsSync(csvFile)) {
  console.error('Place classes.csv in the server folder');
  process.exit(1);
}

// Fájl beolvasása és BOM eltávolítása
const raw = fs.readFileSync(csvFile, 'utf8').replace(/^\uFEFF/, '');

// CSV parse, fejlécek normalizálása (kisbetű, szóköz eltávolítás)
const records = parse(raw, {
  columns: header => header.map(h => h.toLowerCase().trim()),
  skip_empty_lines: true,
  delimiter: ';'
});

// Először minden osztályt INSERT-álunk, ha még nincs az adatbázisban
const insertClass = db.prepare('INSERT OR IGNORE INTO classes (name) VALUES (?)');
for (const r of records) {
  const cls = r.class?.trim();
  if (!cls) continue;
  insertClass.run(cls);
}

// Most UPDATE a terem és téma mezőket
const updateClass = db.prepare('UPDATE classes SET room = ?, theme = ? WHERE name = ?');
for (const r of records) {
  const cls = r.class?.trim();
  const room = r.room?.trim() || null;
  const theme = r.theme?.trim() || null;
  if (!cls) continue;

  const info = updateClass.run(room, theme, cls);
  if (info.changes === 0) {
    console.warn(`Class not found in DB (skipped): ${cls}`);
  }
}

console.log(`✅ ${records.length} osztály feldolgozva, terem és téma mezők frissítve.`);
