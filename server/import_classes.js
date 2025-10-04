const fs = require('fs');
const { parse } = require('csv-parse/sync');
const pool = require('./db');

async function main() {
  const csvFile = './classes.csv';
  if (!fs.existsSync(csvFile)) {
    console.error('Place classes.csv in the server folder');
    process.exit(1);
  }

  const raw = fs.readFileSync(csvFile, 'utf8').replace(/^\uFEFF/, '');
  const records = parse(raw, {
    columns: header => header.map(h => h.toLowerCase().trim()),
    skip_empty_lines: true,
    delimiter: ';'
  });

  for (const r of records) {
    const cls = r.class?.trim();
    if (!cls) continue;

    // beszúrjuk az osztályt ha nem létezik
    await pool.query(
      `INSERT INTO classes (name) VALUES ($1)
       ON CONFLICT (name) DO NOTHING`,
      [cls]
    );

    // update room & theme
    const room = r.room?.trim() || null;
    const theme = r.theme?.trim() || null;
    await pool.query(
      `UPDATE classes SET room=$1, theme=$2 WHERE name=$3`,
      [room, theme, cls]
    );
  }

  console.log(`✅ ${records.length} osztály feldolgozva, terem és téma mezők frissítve.`);
  await pool.end();
}

main();
