import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../db.js';
import { authMiddleware } from '../auth.js';

const router = Router();

// All diagram routes require authentication
router.use(authMiddleware);

interface CreateDiagramBody {
  name?: string;
  data?: unknown;
}

interface UpdateDiagramBody {
  name?: string;
  data?: unknown;
}

/**
 * GET /api/diagrams
 * List all diagrams belonging to the authenticated user.
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const diagrams = await db.collection('diagrams')
      .find({ user_id: req.userId })
      .sort({ updated_at: -1 })
      .toArray();

    const parsed = diagrams.map((d) => ({
      id: d._id,
      user_id: d.user_id,
      name: d.name,
      data: d.data,
      created_at: d.created_at,
      updated_at: d.updated_at,
    }));

    res.json({ diagrams: parsed });
  } catch (error) {
    console.error('[Diagrams] List error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

/**
 * POST /api/diagrams
 * Create a new diagram.
 */
router.post('/', async (req: Request<object, object, CreateDiagramBody>, res: Response): Promise<void> => {
  try {
    const { name, data } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ message: 'Diagram name is required.' });
      return;
    }

    const db = getDatabase();
    const id = uuidv4();
    const now = new Date().toISOString();

    await db.collection('diagrams').insertOne({
      _id: id as any,
      user_id: req.userId,
      name: name.trim(),
      data: data ?? {},
      created_at: now,
      updated_at: now,
    });

    res.status(201).json({
      diagram: { id, user_id: req.userId, name: name.trim(), data: data ?? {}, created_at: now, updated_at: now },
    });
  } catch (error) {
    console.error('[Diagrams] Create error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

/**
 * PUT /api/diagrams/:id
 * Update an existing diagram.
 */
router.put('/:id', async (req: Request<{ id: string }, object, UpdateDiagramBody>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, data } = req.body;

    const db = getDatabase();
    const diagrams = db.collection('diagrams');

    const existing = await diagrams.findOne({ _id: id as any, user_id: req.userId });

    if (!existing) {
      res.status(404).json({ message: 'Diagram not found.' });
      return;
    }

    const now = new Date().toISOString();
    const updatedName = name !== undefined ? (typeof name === 'string' ? name.trim() : existing.name) : existing.name;
    const updatedData = data !== undefined ? data : existing.data;

    await diagrams.updateOne(
      { _id: id as any, user_id: req.userId },
      { $set: { name: updatedName, data: updatedData, updated_at: now } }
    );

    res.json({
      diagram: {
        id,
        user_id: req.userId,
        name: updatedName,
        data: updatedData,
        created_at: existing.created_at,
        updated_at: now,
      },
    });
  } catch (error) {
    console.error('[Diagrams] Update error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

/**
 * DELETE /api/diagrams/:id
 * Delete a diagram.
 */
router.delete('/:id', async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    const result = await db.collection('diagrams').deleteOne({ _id: id as any, user_id: req.userId });

    if (result.deletedCount === 0) {
      res.status(404).json({ message: 'Diagram not found.' });
      return;
    }

    res.json({ message: 'Diagram deleted.' });
  } catch (error) {
    console.error('[Diagrams] Delete error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

export default router;
