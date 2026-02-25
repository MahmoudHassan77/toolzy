import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { getDatabase } from '../db.js';
import { authMiddleware } from '../auth.js';
import multer from 'multer';

// Use /tmp on serverless (Vercel), otherwise project-local uploads dir
const IS_SERVERLESS = !!process.env.VERCEL;
const UPLOADS_DIR = IS_SERVERLESS
  ? path.join(os.tmpdir(), 'uploads')
  : path.join(process.cwd(), 'uploads');

// Ensure uploads directory exists (safe on both local and /tmp)
try {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
} catch {
  // read-only filesystem — uploads won't work but other routes should
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    // Generate a unique filename to avoid collisions
    const ext = path.extname(file.originalname);
    const uniqueName = `${uuidv4()}${ext}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

const router = Router();

// All file routes require authentication
router.use(authMiddleware);

/**
 * POST /api/files/upload
 * Upload a file via multipart form data.
 */
router.post('/upload', upload.single('file'), async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ message: 'No file provided. Use the "file" field.' });
      return;
    }

    const db = getDatabase();
    const id = uuidv4();
    const now = new Date().toISOString();

    const fileRecord = {
      _id: id as any,
      user_id: req.userId!,
      filename: req.file.originalname,
      mimetype: req.file.mimetype,
      path: req.file.filename, // The stored filename on disk
      size: req.file.size,
      created_at: now,
    };

    await db.collection('files').insertOne(fileRecord);

    res.status(201).json({
      file: {
        id: fileRecord._id,
        filename: fileRecord.filename,
        mimetype: fileRecord.mimetype,
        size: fileRecord.size,
        created_at: fileRecord.created_at,
      },
    });
  } catch (error) {
    console.error('[Files] Upload error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

/**
 * GET /api/files/:id
 * Get file metadata.
 */
router.get('/:id', async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    const file = await db.collection('files').findOne({ _id: id as any, user_id: req.userId });

    if (!file) {
      res.status(404).json({ message: 'File not found.' });
      return;
    }

    res.json({
      file: {
        id: file._id,
        filename: file.filename,
        mimetype: file.mimetype,
        size: file.size,
        created_at: file.created_at,
      },
    });
  } catch (error) {
    console.error('[Files] Get error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

/**
 * GET /api/files/:id/download
 * Download the file (serve from disk).
 */
router.get('/:id/download', async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    const file = await db.collection('files').findOne({ _id: id as any, user_id: req.userId });

    if (!file) {
      res.status(404).json({ message: 'File not found.' });
      return;
    }

    const filePath = path.join(UPLOADS_DIR, file.path);

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ message: 'File no longer exists on disk.' });
      return;
    }

    res.setHeader('Content-Type', file.mimetype);
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.sendFile(filePath);
  } catch (error) {
    console.error('[Files] Download error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

export default router;
