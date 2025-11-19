import express, { Express, Request, Response } from 'express';
import multer, { StorageEngine, FileFilterCallback } from 'multer';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import db from './db'; // Import the TypeScript database instance

const app: Express = express();
const PORT: number = 3000;

// ------------------- Middleware Setup -------------------
app.use(cors()); // Enable Cross-Origin Resource Sharing (for frontend-backend communication)
app.use(express.json()); // Parse JSON request bodies
// Static file service: Expose the "uploads" directory to access images via URL (e.g., /uploads/image-123.jpg)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ------------------- File Upload Configuration (multer) -------------------
// Storage strategy: Customize where and how uploaded files are stored
const storage: StorageEngine = multer.diskStorage({
  destination: (req: Request, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
    const uploadDir: string = path.join(__dirname, 'uploads');
    // Create "uploads" directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: (req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    // Generate a unique filename: "image-timestamp.fileExtension" (avoids overwriting)
    const fileExt: string | undefined = file.originalname.split('.').pop();
    const uniqueName: string = `image-${Date.now()}.${fileExt}`;
    cb(null, uniqueName);
  }
});

// File filter: Only allow JPG/PNG images and restrict file size to 5MB
const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
) => {
  const allowedTypes: string[] = ['image/jpeg', 'image/png', 'image/jpg'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true); // Accept the file
  } else {
    cb(new Error('Only JPG/PNG image files are allowed!')); // Reject the file and return an error
  }
};

// Initialize multer instance with storage and filter rules
const upload: multer.Multer = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB file size limit (in bytes)
  fileFilter: fileFilter
});

// ------------------- API Endpoints (Existing + New Delete Endpoints) -------------------
// 1. Upload Image Endpoint
app.post(
  '/api/images',
  upload.single('image'), // Single file upload (file field name: "image")
  (req: Request, res: Response) => {
    // Check if no file was uploaded
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded!' });
    }

    const { filename, path: filePath } = req.file;
    // Insert image metadata into the database
    db.run(
      `INSERT INTO images (filename, file_path) VALUES (?, ?)`,
      [filename, filePath],
      function (err) {
        if (err) {
          return res.status(400).json({ error: err.message });
        }
        // Return the new image's ID and filename (201 = Created status code)
        res.status(201).json({ imageId: this.lastID, filename });
      }
    );
  }
);

// 2. Add Label to Image Endpoint
app.post('/api/annotations', (req: Request, res: Response) => {
  // Define request body type (avoids "any" type and enables type hints)
  interface AnnotationBody {
    imageId: number;
    labelName: string;
  }
  const { imageId, labelName }: AnnotationBody = req.body;

  // Validate input data
  if (!imageId || !labelName) {
    return res.status(400).json({ error: 'Image ID and label name are required!' });
  }
  if (labelName.length > 50) {
    return res.status(400).json({ error: 'Label name cannot exceed 50 characters!' });
  }

  // Step 1: Check if the label already exists in the "labels" table
  db.get(`SELECT id FROM labels WHERE name = ?`, [labelName], (err, label) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }

    if (label) {
      // Label exists: Link the existing label to the image (avoid duplicate links with INSERT OR IGNORE)
      db.run(
        `INSERT OR IGNORE INTO annotations (image_id, label_id) VALUES (?, ?)`,
        [imageId, label.id],
        (err) => {
          if (err) {
            return res.status(400).json({ error: err.message });
          }
          res.json({ success: true, message: 'Label added (or already linked to the image)!' });
        }
      );
    } else {
      // Label does not exist: First create the label, then link it to the image
      db.run(`INSERT INTO labels (name) VALUES (?)`, [labelName], function (err) {
        if (err) {
          return res.status(400).json({ error: err.message });
        }
        // Link the newly created label to the image
        db.run(
          `INSERT INTO annotations (image_id, label_id) VALUES (?, ?)`,
          [imageId, this.lastID],
          (err) => {
            if (err) {
              return res.status(400).json({ error: err.message });
            }
            res.json({ success: true, message: 'New label created and linked to the image!' });
          }
        );
      });
    }
  });
});

// 3. Get All Images (with Linked Labels) Endpoint
app.get('/api/images', (req: Request, res: Response) => {
  // Define response data type (for type safety and clear structure)
  interface ImageWithLabels {
    id: number;
    filename: string;
    file_path: string;
    labels: string | null; // Concatenated label names (e.g., "cat, dog")
    labelIds: string | null; // Concatenated label IDs (e.g., "1, 2")
  }

  const query: string = `
    SELECT i.id, i.filename, i.file_path, GROUP_CONCAT(l.name, ', ') as labels,
           GROUP_CONCAT(l.id, ', ') as labelIds
    FROM images i
    LEFT JOIN annotations a ON i.id = a.image_id
    LEFT JOIN labels l ON a.label_id = l.id
    GROUP BY i.id
  `;

  db.all<ImageWithLabels[]>(query, (err, rows) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    res.json(rows);
  });
});

// 4. Delete Image (with Linked Annotations and Physical File) Endpoint
app.delete('/api/images/:id', (req: Request, res: Response) => {
  // Parse image ID from URL parameter (convert to number)
  const imageId: number = parseInt(req.params.id, 10);
  if (isNaN(imageId)) {
    return res.status(400).json({ error: 'Invalid image ID (must be a number)!' });
  }

  // Step 1: Fetch the image's file path (to delete the physical file later)
  db.get(`SELECT file_path FROM images WHERE id = ?`, [imageId], (err, image) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    if (!image) {
      return res.status(404).json({ error: 'Image not found in the database!' });
    }

    // Step 2: Delete the physical image file from the filesystem
    // Note: Log errors but don't block DB deletion if file removal fails
    fs.unlink(image.file_path, (err) => {
      if (err) {
        console.error('File deletion failed:', err.message);
      }

      // Step 3: Delete linked annotations (redundant but safe—foreign key already has cascade delete)
      db.run(`DELETE FROM annotations WHERE image_id = ?`, [imageId], (err) => {
        if (err) {
          return res.status(400).json({ error: err.message });
        }

        // Step 4: Delete the image record from the database
        db.run(`DELETE FROM images WHERE id = ?`, [imageId], (err) => {
          if (err) {
            return res.status(400).json({ error: err.message });
          }
          res.json({ success: true, message: 'Image deleted successfully (including file and annotations)!' });
        });
      });
    });
  });
});

// 5. Remove Label from Image (Delete Annotation) Endpoint
app.delete('/api/annotations', (req: Request, res: Response) => {
  // Define request body type
  interface DeleteAnnotationBody {
    imageId: number;
    labelId: number;
  }
  const { imageId, labelId }: DeleteAnnotationBody = req.body;

  // Validate input (ensure IDs are valid numbers)
  if (!imageId || !labelId || isNaN(imageId) || isNaN(labelId)) {
    return res.status(400).json({ error: 'Valid Image ID and Label ID (numbers) are required!' });
  }

  // Delete the annotation (link between image and label)
  db.run(
    `DELETE FROM annotations WHERE image_id = ? AND label_id = ?`,
    [imageId, labelId],
    (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      res.json({ success: true, message: 'Label removed from the image successfully!' });
    }
  );
});

// ------------------- Start Server -------------------
app.listen(PORT, () => {
  console.log(`Backend server running at http://localhost:${PORT}`);
});
