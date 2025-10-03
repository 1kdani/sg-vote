const fs = require('fs');
const { parse } = require("csv-parse/sync");
const bcrypt = require('bcrypt');
const db = require('./db');

const csvFile = './students.csv';
if (!fs.existsSync(csvFile)) return console.error('Place students.csv (Name;Class) in server/');

// BOM eltávolítás a fájl elejéről
const raw = fs.readFileSync(csvFile, 'utf8').replace(/^\uFEFF/, '');

// Itt beállítjuk a pontosvesszőt szeparátornak és normalizáljuk a headereket
const records = parse(raw, { 
  columns: header => header.map(h => h.toLowerCase().replace(/\uFEFF/g, '')), 
  skip_empty_lines: true,
  delimiter: ";" 
});

function genPassword() {
  // rövid, olvasható jelszó: 8 karakter, szám+betű
  return Math.random().toString(36).slice(-8);
}

const out = [];
const insertClass = db.prepare('INSERT OR IGNORE INTO classes (name) VALUES (?)');
const getClassId = db.prepare('SELECT id FROM classes WHERE name = ?');
const insert = db.prepare('INSERT OR REPLACE INTO users (name, class, password_hash, votes_used) VALUES (?, ?, ?, ?)');

for (const r of records) {
  const name = r.name.trim();
  const cls = r.class?.trim();  // lehet undefined vagy üres string

  let classId = null;
  if (cls) {
    insertClass.run(cls);
    const classRow = getClassId.get(cls);
    classId = classRow.id;
  }

  const pw = r.password?.trim() || genPassword();
  const hash = bcrypt.hashSync(pw, 10);

  // fontos: class helyett classId-t mentsünk!
  insert.run(name, classId, hash, 0);

  out.push({ Name: name, Class: cls || "", Password: pw, ClassId: classId });
}


// write students_with_pw.csv
const header = 'Name,Class,Password\n';
const body = out.map(o => `${o.Name},${o.Class},${o.Password}`).join('\n');
fs.writeFileSync('./students_with_pw.csv', header + body);

console.log(`✅ Importálva ${out.length} diák, jelszavak mentve a students_with_pw.csv fájlba`);