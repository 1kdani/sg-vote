const fs = require('fs');
const db = require('./db');

const migrations = fs.readFileSync(__dirname + '/migrations.sql', 'utf8');
db.exec(migrations);

console.log('✅ Adatbázis inicializálva.');
