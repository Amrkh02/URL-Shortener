const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = process.env.SQLITE_FILE || path.join(__dirname, 'data.db');
const db = new sqlite3.Database(dbPath);

// Initialize schema and pragmas
db.serialize(() => {
  db.run('PRAGMA foreign_keys = ON');

  db.run(`
    CREATE TABLE IF NOT EXISTS urls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      short_id TEXT UNIQUE NOT NULL,
      long_url TEXT NOT NULL,
      clicks INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS analytics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      short_id TEXT NOT NULL,
      ip TEXT,
      country TEXT,
      user_agent TEXT,
      device TEXT,
      browser TEXT,
      referrer TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (short_id) REFERENCES urls(short_id) ON DELETE CASCADE
    )
  `);

  db.run('CREATE INDEX IF NOT EXISTS idx_analytics_short ON analytics(short_id)');
});

module.exports = {
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) return reject(err);
        resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  },
  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });
  },
  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  },
  close() {
    return new Promise((resolve, reject) => db.close(err => (err ? reject(err) : resolve())));
  }
};
