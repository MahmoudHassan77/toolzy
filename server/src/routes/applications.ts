import { Router, Request, Response } from 'express';
import { getDatabase } from '../db.js';
import { authMiddleware } from '../auth.js';

const router = Router();
router.use(authMiddleware);

/** GET /api/applications — list all applications for the user */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const docs = await db.collection('applications')
      .find({ user_id: req.userId })
      .sort({ updated_at: -1 })
      .toArray();

    const applications = docs.map((r) => ({ ...r.data, id: r._id }));
    res.json({ applications });
  } catch (error) {
    console.error('[Applications] List error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

/** POST /api/applications — create an application */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const app = req.body as { id: string; [key: string]: unknown };
    if (!app || !app.id) { res.status(400).json({ message: 'Application with id required.' }); return; }

    const db = getDatabase();
    const now = new Date().toISOString();

    await db.collection('applications').updateOne(
      { _id: app.id as any },
      { $set: { user_id: req.userId, data: app, created_at: now, updated_at: now } },
      { upsert: true }
    );

    res.status(201).json({ application: app });
  } catch (error) {
    console.error('[Applications] Create error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

/** PUT /api/applications/:id — update an application */
router.put('/:id', async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const patch = req.body as Record<string, unknown>;
    const db = getDatabase();
    const col = db.collection('applications');

    const existing = await col.findOne({ _id: id as any, user_id: req.userId });
    if (!existing) { res.status(404).json({ message: 'Application not found.' }); return; }

    const merged = { ...existing.data, ...patch, id };
    const now = new Date().toISOString();

    await col.updateOne(
      { _id: id as any, user_id: req.userId },
      { $set: { data: merged, updated_at: now } }
    );

    res.json({ application: merged });
  } catch (error) {
    console.error('[Applications] Update error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

/** DELETE /api/applications/:id */
router.delete('/:id', async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    const result = await db.collection('applications').deleteOne({ _id: id as any, user_id: req.userId });
    if (result.deletedCount === 0) { res.status(404).json({ message: 'Application not found.' }); return; }
    res.json({ message: 'Application deleted.' });
  } catch (error) {
    console.error('[Applications] Delete error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

/** POST /api/applications/sync — bulk upsert all applications */
router.post('/sync', async (req: Request, res: Response): Promise<void> => {
  try {
    const { applications } = req.body as { applications: Array<{ id: string; [key: string]: unknown }> };
    if (!Array.isArray(applications)) { res.status(400).json({ message: 'applications array required.' }); return; }

    const db = getDatabase();
    const col = db.collection('applications');

    if (applications.length > 0) {
      const ops = applications.map((app) => {
        const now = (app.updatedAt as string) || new Date().toISOString();
        return {
          updateOne: {
            filter: { _id: app.id as any },
            update: { $set: { user_id: req.userId, data: app, created_at: (app.createdAt as string) || now, updated_at: now } },
            upsert: true,
          },
        };
      });
      await col.bulkWrite(ops);
    }

    const docs = await col.find({ user_id: req.userId }).sort({ updated_at: -1 }).toArray();
    const all = docs.map((r) => ({ ...r.data, id: r._id }));
    res.json({ applications: all });
  } catch (error) {
    console.error('[Applications] Sync error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

export default router;
