const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('db.sqlite3');

// Initialize database
db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS images (id INTEGER PRIMARY KEY, filename TEXT, label TEXT)");
});

const insertImage = (filename, label) => {
    return new Promise((resolve, reject) => {
        db.run("INSERT INTO images (filename, label) VALUES (?, ?)", [filename, label], function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
        });
    });
};

const getImages = () => {
    return new Promise((resolve, reject) => {
        db.all("SELECT * FROM images", [], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

module.exports = { insertImage, getImages };