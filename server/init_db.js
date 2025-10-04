const fs = require('fs');
const pool = require('./db');

async function init() {
  const migrations = fs.readFileSync(__dirname + '/migrations.sql', 'utf8');
  try {
    await pool.query(migrations);
    console.log('✅ Adatbázis inicializálva.');
  } catch (err) {
    console.error('❌ Hiba az adatbázis inicializálásakor:', err);
  } finally {
    await pool.end();
  }
}

init();
