import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../db.js';
import { authMiddleware } from '../auth.js';

const router = Router();
router.use(authMiddleware);

function docToTodo(doc: any) {
  return {
    id: doc._id,
    text: doc.text,
    done: !!doc.done,
    priority: doc.priority,
    dueDate: doc.due_date ?? undefined,
    createdAt: new Date(doc.created_at).getTime(),
  };
}

/** GET /api/todos */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const docs = await db.collection('todos')
      .find({ user_id: req.userId })
      .sort({ created_at: -1 })
      .toArray();
    res.json({ todos: docs.map(docToTodo) });
  } catch (error) {
    console.error('[Todos] List error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

/** POST /api/todos — create a todo */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, text, done, priority, dueDate, createdAt } = req.body as {
      id?: string; text: string; done?: boolean; priority?: string; dueDate?: string; createdAt?: number;
    };
    if (!text) { res.status(400).json({ message: 'text is required.' }); return; }

    const db = getDatabase();
    const todoId = id || uuidv4();
    const now = createdAt ? new Date(createdAt).toISOString() : new Date().toISOString();

    await db.collection('todos').updateOne(
      { _id: todoId as any },
      { $set: { user_id: req.userId, text, done: done ?? false, priority: priority ?? 'medium', due_date: dueDate ?? null, created_at: now } },
      { upsert: true }
    );

    res.status(201).json({
      todo: { id: todoId, text, done: done ?? false, priority: priority ?? 'medium', dueDate, createdAt: new Date(now).getTime() },
    });
  } catch (error) {
    console.error('[Todos] Create error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

/** PUT /api/todos/:id */
router.put('/:id', async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { text, done, priority, dueDate } = req.body as {
      text?: string; done?: boolean; priority?: string; dueDate?: string | null;
    };
    const db = getDatabase();
    const todos = db.collection('todos');

    const existing = await todos.findOne({ _id: id as any, user_id: req.userId });
    if (!existing) { res.status(404).json({ message: 'Todo not found.' }); return; }

    const updText = text !== undefined ? text : existing.text;
    const updDone = done !== undefined ? done : existing.done;
    const updPriority = priority !== undefined ? priority : existing.priority;
    const updDueDate = dueDate !== undefined ? dueDate : existing.due_date;

    await todos.updateOne(
      { _id: id as any, user_id: req.userId },
      { $set: { text: updText, done: updDone, priority: updPriority, due_date: updDueDate } }
    );

    res.json({ todo: { id, text: updText, done: !!updDone, priority: updPriority, dueDate: updDueDate ?? undefined, createdAt: new Date(existing.created_at).getTime() } });
  } catch (error) {
    console.error('[Todos] Update error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

/** DELETE /api/todos/:id */
router.delete('/:id', async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    const result = await db.collection('todos').deleteOne({ _id: id as any, user_id: req.userId });
    if (result.deletedCount === 0) { res.status(404).json({ message: 'Todo not found.' }); return; }
    res.json({ message: 'Todo deleted.' });
  } catch (error) {
    console.error('[Todos] Delete error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

/** POST /api/todos/sync — bulk upsert */
router.post('/sync', async (req: Request, res: Response): Promise<void> => {
  try {
    const { todos } = req.body as { todos: Array<{ id: string; text: string; done: boolean; priority: string; dueDate?: string; createdAt: number }> };
    if (!Array.isArray(todos)) { res.status(400).json({ message: 'todos array required.' }); return; }

    const db = getDatabase();
    const col = db.collection('todos');

    if (todos.length > 0) {
      const ops = todos.map((t) => ({
        updateOne: {
          filter: { _id: t.id as any },
          update: { $set: { user_id: req.userId, text: t.text, done: t.done, priority: t.priority, due_date: t.dueDate ?? null, created_at: new Date(t.createdAt).toISOString() } },
          upsert: true,
        },
      }));
      await col.bulkWrite(ops);
    }

    const docs = await col.find({ user_id: req.userId }).sort({ created_at: -1 }).toArray();
    res.json({ todos: docs.map(docToTodo) });
  } catch (error) {
    console.error('[Todos] Sync error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

export default router;
