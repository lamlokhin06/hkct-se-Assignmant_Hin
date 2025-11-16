const express = require('express');
const multer = require('multer');
const path = require('path');
const db = require('../models/db');

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

router.post('/upload', upload.single('image'), async (req, res) => {
    const label = req.body.label;
    const imagePath = `/uploads/${req.file.filename}`;

    try {
        await db.insertImage(req.file.filename, label);
        res.status(200).send({ message: 'Image uploaded' });
    } catch (error) {
        res.status(500).send({ error: 'Error uploading image' });
    }
});

router.get('/images', async (req, res) => {
    try {
        const images = await db.getImages();
        res.status(200).json(images);
    } catch (error) {
        res.status(500).send({ error: 'Error fetching images' });
    }
});

module.exports = router;