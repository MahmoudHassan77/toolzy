import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { initDatabase } from './db.js';
import authRoutes from './routes/auth.js';
import oauthRoutes from './routes/oauth.js';
import boardRoutes from './routes/boards.js';
import diagramRoutes from './routes/diagrams.js';
import fileRoutes from './routes/files.js';
import noteRoutes from './routes/notes.js';
import todoRoutes from './routes/todos.js';
import calendarRoutes from './routes/calendar.js';
import applicationRoutes from './routes/applications.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '3001', 10);
const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

async function main() {
  // Initialize the database (async for MongoDB)
  await initDatabase();

  // Create Express app
  const app = express();

  // CORS configuration
  app.use(
    cors({
      origin: [
        'http://localhost:5173', // Vite dev server
        ...(process.env.CORS_ORIGIN ? [process.env.CORS_ORIGIN] : []),
      ],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  // JSON body parser
  app.use(express.json({ limit: '10mb' }));

  // URL-encoded body parser
  app.use(express.urlencoded({ extended: true }));

  // Mount API routes
  app.use('/api/auth', authRoutes);
  app.use('/api/auth', oauthRoutes);
  app.use('/api/boards', boardRoutes);
  app.use('/api/diagrams', diagramRoutes);
  app.use('/api/files', fileRoutes);
  app.use('/api/notes', noteRoutes);
  app.use('/api/todos', todoRoutes);
  app.use('/api/calendar', calendarRoutes);
  app.use('/api/applications', applicationRoutes);

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // 404 handler for unknown API routes
  app.use('/api', (_req, res) => {
    res.status(404).json({ message: 'API endpoint not found.' });
  });

  // Global error handler
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[Server] Unhandled error:', err);
    res.status(500).json({ message: 'Internal server error.' });
  });

  // Start the server
  app.listen(PORT, () => {
    console.log(`[Server] MyServices API running on http://localhost:${PORT}`);
    console.log(`[Server] Uploads directory: ${UPLOADS_DIR}`);
  });
}

main().catch((err) => {
  console.error('[Server] Failed to start:', err);
  process.exit(1);
});
