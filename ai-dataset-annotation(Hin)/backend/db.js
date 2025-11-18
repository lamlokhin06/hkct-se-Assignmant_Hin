const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to SQLite database (creates db.sqlite3 if missing)
const db = new sqlite3.Database(path.join(__dirname, 'db.sqlite3'), (err) => {
  if (err) console.error('DB Connection Error:', err.message);
  else console.log('Connected to SQLite DB');
});

// Create 3 required tables (run once on server start)
db.serialize(() => {
  // 1. Images table (stores image metadata)
  db.run(`CREATE TABLE IF NOT EXISTS images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL UNIQUE,  # Name of uploaded image file
    upload_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    file_path TEXT NOT NULL  # Path to stored image
  )`);

  // 2. Labels table (stores all possible text labels)
  db.run(`CREATE TABLE IF NOT EXISTS labels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE  # e.g., "cat", "car"
  )`);

  // 3. Annotations table (links images to labels)
  db.run(`CREATE TABLE IF NOT EXISTS annotations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    image_id INTEGER NOT NULL,
    label_id INTEGER NOT NULL,
    FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE,
    FOREIGN KEY (label_id) REFERENCES labels(id) ON DELETE CASCADE,
    UNIQUE(image_id, label_id)  # Prevent duplicate labels for 1 image
  )`);

  // Sample data (for testing)
  db.run(`INSERT OR IGNORE INTO labels (name) VALUES 
    ('cat'), ('dog'), ('car')`);
});

module.exports = db;
