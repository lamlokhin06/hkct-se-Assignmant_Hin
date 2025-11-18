const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Configure image upload (with 5MB size limit)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `image-${Date.now()}.${file.originalname.split('.').pop()}`;
    cb(null, uniqueName);
  }
});
// Add validation: only images + max 5MB
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (allowedTypes.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPG/PNG images are allowed!'), false);
  }
});

// ------------------- Existing APIs -------------------
// 1. Upload image
app.post('/api/images', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image uploaded!' });
  
  const { filename, path: filePath } = req.file;
  db.run(
    `INSERT INTO images (filename, file_path) VALUES (?, ?)`,
    [filename, filePath],
    function (err) {
      if (err) return res.status(400).json({ error: err.message });
      res.status(201).json({ imageId: this.lastID, filename });
    }
  );
});

// 2. Add label to image
app.post('/api/annotations', (req, res) => {
  const { imageId, labelName } = req.body;
  
  // Validate input
  if (!imageId || !labelName) 
    return res.status(400).json({ error: 'Image ID and label name are required!' });
  if (labelName.length > 50) 
    return res.status(400).json({ error: 'Label name cannot exceed 50 characters!' });

  db.get(`SELECT id FROM labels WHERE name = ?`, [labelName], (err, label) => {
    if (err) return res.status(400).json({ error: err.message });

    if (label) {
      db.run(
        `INSERT OR IGNORE INTO annotations (image_id, label_id) VALUES (?, ?)`,
        [imageId, label.id],
        (err) => {
          if (err) return res.status(400).json({ error: err.message });
          res.json({ success: true, message: 'Label added (or already exists)!' });
        }
      );
    } else {
      db.run(`INSERT INTO labels (name) VALUES (?)`, [labelName], function (err) {
        if (err) return res.status(400).json({ error: err.message });
        db.run(
          `INSERT INTO annotations (image_id, label_id) VALUES (?, ?)`,
          [imageId, this.lastID],
          (err) => {
            if (err) return res.status(400).json({ error: err.message });
            res.json({ success: true, message: 'New label created and added!' });
          }
        );
      });
    }
  });
});

// 3. Get all images with labels
app.get('/api/images', (req, res) => {
  const query = `
    SELECT i.id, i.filename, i.file_path, GROUP_CONCAT(l.name, ', ') as labels,
           GROUP_CONCAT(l.id, ', ') as labelIds  -- Return label IDs for delete
    FROM images i
    LEFT JOIN annotations a ON i.id = a.image_id
    LEFT JOIN labels l ON a.label_id = l.id
    GROUP BY i.id
  `;
  db.all(query, (err, rows) => {
    if (err) return res.status(400).json({ error: err.message });
    res.json(rows);
  });
});

// ------------------- New Delete APIs -------------------
// 4. Delete an image (and its annotations + file)
app.delete('/api/images/:id', (req, res) => {
  const imageId = req.params.id;

  // Step 1: Get image path to delete file
  db.get(`SELECT file_path FROM images WHERE id = ?`, [imageId], (err, image) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!image) return res.status(404).json({ error: 'Image not found!' });

    // Step 2: Delete file from filesystem
    fs.unlink(image.file_path, (err) => {
      if (err) console.error('File delete error:', err.message); // Log but don't fail

      // Step 3: Delete annotations (cascades via FOREIGN KEY, but explicit for safety)
      db.run(`DELETE FROM annotations WHERE image_id = ?`, [imageId], (err) => {
        if (err) return res.status(400).json({ error: err.message });

        // Step 4: Delete image from DB
        db.run(`DELETE FROM images WHERE id = ?`, [imageId], (err) => {
          if (err) return res.status(400).json({ error: err.message });
          res.json({ success: true, message: 'Image deleted!' });
        });
      });
    });
  });
});

// 5. Delete a label from an image (delete annotation)
app.delete('/api/annotations', (req, res) => {
  const { imageId, labelId } = req.body;

  if (!imageId || !labelId) 
    return res.status(400).json({ error: 'Image ID and Label ID are required!' });

  db.run(
    `DELETE FROM annotations WHERE image_id = ? AND label_id = ?`,
    [imageId, labelId],
    (err) => {
      if (err) return res.status(400).json({ error: err.message });
      res.json({ success: true, message: 'Label removed from image!' });
    }
  );
});

// Start server
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
