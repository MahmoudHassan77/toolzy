import express from 'express';
import cors from 'cors';
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
import linkRoutes from './routes/links.js';

const app = express();

// CORS configuration
app.use(
  cors({
    origin: [
      'http://localhost:5173',
      'https://toolzyhub.netlify.app',
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

// Ensure DB is connected before handling any request (serverless-safe)
app.use(async (_req, _res, next) => {
  try {
    await initDatabase();
    next();
  } catch (err) {
    next(err);
  }
});

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
app.use('/api/links', linkRoutes);

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

export default app;
