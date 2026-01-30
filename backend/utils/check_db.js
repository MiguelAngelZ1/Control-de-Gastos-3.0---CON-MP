const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const db = new sqlite3.Database(path.join(__dirname, '..', 'data', 'history.db'));
db.all("PRAGMA table_info(month_archives);", [], (err, rows) => {
    if (err) {
        console.error(err);
        process.exit(1);
    }
    const cols = rows.map(r => r.name);
    const required = ['month_key', 'month_name', 'year', 'total_income', 'total_expenses', 'balance', 'full_data'];
    const missing = required.filter(c => !cols.includes(c));
    if (missing.length > 0) {
        console.log('MISSING COLUMNS: ' + missing.join(', '));
    } else {
        console.log('ALL COLUMNS PRESENT');
    }
    db.close();
});
