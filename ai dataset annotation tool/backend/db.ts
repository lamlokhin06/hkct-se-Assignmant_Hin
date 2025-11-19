import sqlite3 from 'sqlite3';
import path from 'path';

// Initialize SQLite database connection (explicitly type `db` as sqlite3.Database)
const db: sqlite3.Database = new sqlite3.Database(
  path.join(__dirname, 'db.sqlite3'), // Path to SQLite file (use __dirname for absolute path)
  (err: Error | null) => {
    if (err) console.error('DB Connection Error:', err.message);
    else console.log('Successfully connected to SQLite database');
  }
);

// Execute SQL sequentially (ensures table creation order and atomicity)
db.serialize(() => {
  // 1. Images table: Stores metadata of uploaded images
  db.run(`CREATE TABLE IF NOT EXISTS images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL UNIQUE,  -- Name of the uploaded image file (unique to avoid duplicates)
    upload_time DATETIME DEFAULT CURRENT_TIMESTAMP,  -- Upload time (defaults to current timestamp)
    file_path TEXT NOT NULL  -- Physical/relative path to the stored image file
  )`);

  // 2. Labels table: Stores all available text labels (e.g., "cat", "car")
  db.run(`CREATE TABLE IF NOT EXISTS labels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE  -- Label name (unique to avoid duplicate labels)
  )`);

  // 3. Annotations table: Links images to labels (many-to-many relationship)
  db.run(`CREATE TABLE IF NOT EXISTS annotations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    image_id INTEGER NOT NULL,  -- Foreign key linking to the images table
    label_id INTEGER NOT NULL,  -- Foreign key linking to the labels table
    -- Foreign key constraints: Auto-delete annotations when linked image/label is deleted (cascade delete)
    FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE,
    FOREIGN KEY (label_id) REFERENCES labels(id) ON DELETE CASCADE,
    UNIQUE(image_id, label_id)  -- Prevent duplicate labels for the same image
  )`);

  // Test data: Insert default labels (use INSERT OR IGNORE to avoid duplicates on server restart)
  db.run(`INSERT OR IGNORE INTO labels (name) VALUES 
    ('cat'), ('dog'), ('car')`);
});

// Export database instance for use in Express routes
export default db;
