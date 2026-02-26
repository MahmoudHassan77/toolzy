import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../db.js';
import { authMiddleware } from '../auth.js';

const router = Router();
router.use(authMiddleware);

/** GET /api/links — list all links for the user */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const docs = await db.collection('links')
      .find({ user_id: req.userId })
      .sort({ updated_at: -1 })
      .toArray();

    const links = docs.map((d) => ({
      id: d._id,
      url: d.url,
      title: d.title,
      category: d.category,
      description: d.description,
      tags: d.tags,
      favicon: d.favicon,
      updated_at: d.updated_at,
      created_at: d.created_at,
    }));

    res.json({ links });
  } catch (error) {
    console.error('[Links] List error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

/** DELETE /api/links/:id */
router.delete('/:id', async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    const result = await db.collection('links').deleteOne({ _id: id as any, user_id: req.userId });
    if (result.deletedCount === 0) { res.status(404).json({ message: 'Link not found.' }); return; }
    res.json({ message: 'Link deleted.' });
  } catch (error) {
    console.error('[Links] Delete error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

/** POST /api/links/sync — bulk upsert all links */
router.post('/sync', async (req: Request, res: Response): Promise<void> => {
  try {
    const { links } = req.body as {
      links: Array<{
        id: string; url: string; title: string; category: string;
        description: string; tags: string[]; favicon: string;
        createdAt: number; updatedAt: number;
      }>
    };
    if (!Array.isArray(links)) { res.status(400).json({ message: 'links array required.' }); return; }

    const db = getDatabase();
    const col = db.collection('links');

    if (links.length > 0) {
      const ops = links.map((l) => {
        const updatedAt = new Date(l.updatedAt).toISOString();
        const createdAt = new Date(l.createdAt).toISOString();
        return {
          updateOne: {
            filter: { _id: l.id as any },
            update: {
              $set: {
                user_id: req.userId,
                url: l.url,
                title: l.title,
                category: l.category,
                description: l.description,
                tags: JSON.stringify(l.tags),
                favicon: l.favicon,
                updated_at: updatedAt,
                created_at: createdAt,
              },
            },
            upsert: true,
          },
        };
      });
      await col.bulkWrite(ops);
    }

    const docs = await col.find({ user_id: req.userId }).sort({ updated_at: -1 }).toArray();
    const all = docs.map((d) => ({
      id: d._id,
      url: d.url,
      title: d.title,
      category: d.category,
      description: d.description,
      tags: d.tags,
      favicon: d.favicon,
      updated_at: d.updated_at,
      created_at: d.created_at,
    }));
    res.json({ links: all });
  } catch (error) {
    console.error('[Links] Sync error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

export default router;
