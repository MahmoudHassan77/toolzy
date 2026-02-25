import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../db.js';
import { authMiddleware } from '../auth.js';

const router = Router();
router.use(authMiddleware);

/** GET /api/notes — list all notes for the user */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const docs = await db.collection('notes')
      .find({ user_id: req.userId })
      .sort({ updated_at: -1 })
      .toArray();

    const notes = docs.map((d) => ({
      id: d._id,
      user_id: d.user_id,
      title: d.title,
      content: d.content,
      updated_at: d.updated_at,
      created_at: d.created_at,
    }));

    res.json({ notes });
  } catch (error) {
    console.error('[Notes] List error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

/** POST /api/notes — create a note */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, title, content, updatedAt } = req.body as {
      id?: string; title?: string; content?: string; updatedAt?: string;
    };
    const db = getDatabase();
    const noteId = id || uuidv4();
    const now = updatedAt || new Date().toISOString();

    await db.collection('notes').updateOne(
      { _id: noteId as any },
      { $set: { user_id: req.userId, title: title ?? 'Untitled', content: content ?? '', updated_at: now, created_at: now } },
      { upsert: true }
    );

    res.status(201).json({
      note: { id: noteId, user_id: req.userId, title: title ?? 'Untitled', content: content ?? '', updated_at: now, created_at: now },
    });
  } catch (error) {
    console.error('[Notes] Create error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

/** PUT /api/notes/:id — update a note */
router.put('/:id', async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { title, content } = req.body as { title?: string; content?: string };
    const db = getDatabase();
    const notes = db.collection('notes');

    const existing = await notes.findOne({ _id: id as any, user_id: req.userId });
    if (!existing) { res.status(404).json({ message: 'Note not found.' }); return; }

    const now = new Date().toISOString();
    const updatedTitle = title !== undefined ? title : existing.title;
    const updatedContent = content !== undefined ? content : existing.content;

    await notes.updateOne(
      { _id: id as any, user_id: req.userId },
      { $set: { title: updatedTitle, content: updatedContent, updated_at: now } }
    );

    res.json({ note: { id: existing._id, user_id: existing.user_id, title: updatedTitle, content: updatedContent, updated_at: now, created_at: existing.created_at } });
  } catch (error) {
    console.error('[Notes] Update error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

/** DELETE /api/notes/:id */
router.delete('/:id', async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    const result = await db.collection('notes').deleteOne({ _id: id as any, user_id: req.userId });
    if (result.deletedCount === 0) { res.status(404).json({ message: 'Note not found.' }); return; }
    res.json({ message: 'Note deleted.' });
  } catch (error) {
    console.error('[Notes] Delete error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

/** POST /api/notes/sync — bulk upsert all notes */
router.post('/sync', async (req: Request, res: Response): Promise<void> => {
  try {
    const { notes } = req.body as { notes: Array<{ id: string; title: string; content: string; updatedAt: number }> };
    if (!Array.isArray(notes)) { res.status(400).json({ message: 'notes array required.' }); return; }

    const db = getDatabase();
    const col = db.collection('notes');

    if (notes.length > 0) {
      const ops = notes.map((n) => {
        const ts = new Date(n.updatedAt).toISOString();
        return {
          updateOne: {
            filter: { _id: n.id as any },
            update: { $set: { user_id: req.userId, title: n.title, content: n.content, updated_at: ts, created_at: ts } },
            upsert: true,
          },
        };
      });
      await col.bulkWrite(ops);
    }

    const docs = await col.find({ user_id: req.userId }).sort({ updated_at: -1 }).toArray();
    const all = docs.map((d) => ({
      id: d._id,
      user_id: d.user_id,
      title: d.title,
      content: d.content,
      updated_at: d.updated_at,
      created_at: d.created_at,
    }));
    res.json({ notes: all });
  } catch (error) {
    console.error('[Notes] Sync error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

export default router;
