const fs = require('fs');
const { parse } = require("csv-parse/sync");
const bcrypt = require('bcrypt');
const pool = require('./db');

async function main() {
  const csvFile = './students.csv';
  if (!fs.existsSync(csvFile)) return console.error('Place students.csv (Name;Class) in server/');

  const raw = fs.readFileSync(csvFile, 'utf8').replace(/^\uFEFF/, '');
  const records = parse(raw, { 
    columns: header => header.map(h => h.toLowerCase().replace(/\uFEFF/g, '')), 
    skip_empty_lines: true,
    delimiter: ";" 
  });

  const out = [];

  for (const r of records) {
    const name = r.name.trim();
    const cls = r.class?.trim();

    let classId = null;
    if (cls) {
      const res = await pool.query(
        'INSERT INTO classes (name) VALUES ($1) ON CONFLICT (name) DO NOTHING RETURNING id',
        [cls]
      );
      if (res.rows.length > 0) {
        classId = res.rows[0].id;
      } else {
        const lookup = await pool.query('SELECT id FROM classes WHERE name=$1', [cls]);
        classId = lookup.rows[0].id;
      }
    }

    const pw = r.password?.trim() || Math.random().toString(36).slice(-8);
    const hash = bcrypt.hashSync(pw, 10);

    await pool.query(
      `INSERT INTO users (name, class_id, password_hash, votes_used) 
       VALUES ($1,$2,$3,0)
       ON CONFLICT (name) DO UPDATE SET class_id=EXCLUDED.class_id, password_hash=EXCLUDED.password_hash`,
      [name, classId, hash]
    );

    out.push({ Name: name, Class: cls || "", Password: pw });
  }

  const header = 'Name,Class,Password\n';
  const body = out.map(o => `${o.Name},${o.Class},${o.Password}`).join('\n');
  fs.writeFileSync('./students_with_pw.csv', header + body);

  console.log(`✅ Importálva ${out.length} diák, jelszavak mentve a students_with_pw.csv fájlba`);
  await pool.end();
}

main();
