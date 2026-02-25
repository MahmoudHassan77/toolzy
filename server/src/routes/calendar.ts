import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../db.js';
import { authMiddleware } from '../auth.js';

const router = Router();
router.use(authMiddleware);

/** GET /api/calendar */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const docs = await db.collection('calendar_events')
      .find({ user_id: req.userId })
      .sort({ date: 1, time: 1 })
      .toArray();

    const events = docs.map((d) => ({
      id: d._id,
      user_id: d.user_id,
      title: d.title,
      date: d.date,
      time: d.time,
      color: d.color,
      description: d.description,
      created_at: d.created_at,
    }));

    res.json({ events });
  } catch (error) {
    console.error('[Calendar] List error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

/** POST /api/calendar */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, title, date, time, color, description } = req.body as {
      id?: string; title: string; date: string; time?: string; color?: string; description?: string;
    };
    if (!title || !date) { res.status(400).json({ message: 'title and date are required.' }); return; }

    const db = getDatabase();
    const eventId = id || uuidv4();
    const now = new Date().toISOString();

    await db.collection('calendar_events').updateOne(
      { _id: eventId as any },
      { $set: { user_id: req.userId, title, date, time: time ?? null, color: color ?? '#3b82f6', description: description ?? '', created_at: now } },
      { upsert: true }
    );

    res.status(201).json({
      event: { id: eventId, user_id: req.userId, title, date, time: time ?? null, color: color ?? '#3b82f6', description: description ?? '', created_at: now },
    });
  } catch (error) {
    console.error('[Calendar] Create error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

/** PUT /api/calendar/:id */
router.put('/:id', async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { title, date, time, color, description } = req.body as {
      title?: string; date?: string; time?: string | null; color?: string; description?: string;
    };
    const db = getDatabase();
    const col = db.collection('calendar_events');

    const existing = await col.findOne({ _id: id as any, user_id: req.userId });
    if (!existing) { res.status(404).json({ message: 'Event not found.' }); return; }

    const upd = {
      title: title ?? existing.title,
      date: date ?? existing.date,
      time: time !== undefined ? time : existing.time,
      color: color ?? existing.color,
      description: description !== undefined ? description : existing.description,
    };

    await col.updateOne(
      { _id: id as any, user_id: req.userId },
      { $set: upd }
    );

    res.json({ event: { id: existing._id, user_id: existing.user_id, ...upd, created_at: existing.created_at } });
  } catch (error) {
    console.error('[Calendar] Update error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

/** DELETE /api/calendar/:id */
router.delete('/:id', async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    const result = await db.collection('calendar_events').deleteOne({ _id: id as any, user_id: req.userId });
    if (result.deletedCount === 0) { res.status(404).json({ message: 'Event not found.' }); return; }
    res.json({ message: 'Event deleted.' });
  } catch (error) {
    console.error('[Calendar] Delete error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

/** POST /api/calendar/sync — bulk upsert */
router.post('/sync', async (req: Request, res: Response): Promise<void> => {
  try {
    const { events } = req.body as { events: Array<{ id: string; title: string; date: string; time?: string | null; color?: string; description?: string; created_at?: string }> };
    if (!Array.isArray(events)) { res.status(400).json({ message: 'events array required.' }); return; }

    const db = getDatabase();
    const col = db.collection('calendar_events');

    if (events.length > 0) {
      const ops = events.map((e) => ({
        updateOne: {
          filter: { _id: e.id as any },
          update: { $set: { user_id: req.userId, title: e.title, date: e.date, time: e.time ?? null, color: e.color ?? '#3b82f6', description: e.description ?? '', created_at: e.created_at || new Date().toISOString() } },
          upsert: true,
        },
      }));
      await col.bulkWrite(ops);
    }

    const docs = await col.find({ user_id: req.userId }).sort({ date: 1, time: 1 }).toArray();
    const all = docs.map((d) => ({
      id: d._id,
      user_id: d.user_id,
      title: d.title,
      date: d.date,
      time: d.time,
      color: d.color,
      description: d.description,
      created_at: d.created_at,
    }));
    res.json({ events: all });
  } catch (error) {
    console.error('[Calendar] Sync error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

export default router;
