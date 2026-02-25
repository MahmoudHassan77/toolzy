import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../db.js';
import { authMiddleware } from '../auth.js';

const router = Router();

// All board routes require authentication
router.use(authMiddleware);

interface CreateBoardBody {
  name?: string;
  data?: unknown;
}

interface UpdateBoardBody {
  name?: string;
  data?: unknown;
}

/**
 * GET /api/boards
 * List all boards belonging to the authenticated user.
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const boards = await db.collection('boards')
      .find({ user_id: req.userId })
      .sort({ updated_at: -1 })
      .toArray();

    const parsed = boards.map((b) => ({
      id: b._id,
      user_id: b.user_id,
      name: b.name,
      data: b.data,
      created_at: b.created_at,
      updated_at: b.updated_at,
    }));

    res.json({ boards: parsed });
  } catch (error) {
    console.error('[Boards] List error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

/**
 * POST /api/boards
 * Create a new board.
 */
router.post('/', async (req: Request<object, object, CreateBoardBody>, res: Response): Promise<void> => {
  try {
    const { name, data } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ message: 'Board name is required.' });
      return;
    }

    const db = getDatabase();
    const id = uuidv4();
    const now = new Date().toISOString();

    await db.collection('boards').insertOne({
      _id: id as any,
      user_id: req.userId,
      name: name.trim(),
      data: data ?? {},
      created_at: now,
      updated_at: now,
    });

    res.status(201).json({
      board: { id, user_id: req.userId, name: name.trim(), data: data ?? {}, created_at: now, updated_at: now },
    });
  } catch (error) {
    console.error('[Boards] Create error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

/**
 * PUT /api/boards/:id
 * Update an existing board. The `data` field is the full Kanban board JSON.
 */
router.put('/:id', async (req: Request<{ id: string }, object, UpdateBoardBody>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, data } = req.body;

    const db = getDatabase();
    const boards = db.collection('boards');

    // Verify the board exists and belongs to this user
    const existing = await boards.findOne({ _id: id as any, user_id: req.userId });

    if (!existing) {
      res.status(404).json({ message: 'Board not found.' });
      return;
    }

    const now = new Date().toISOString();
    const updatedName = name !== undefined ? (typeof name === 'string' ? name.trim() : existing.name) : existing.name;
    const updatedData = data !== undefined ? data : existing.data;

    await boards.updateOne(
      { _id: id as any, user_id: req.userId },
      { $set: { name: updatedName, data: updatedData, updated_at: now } }
    );

    res.json({
      board: {
        id,
        user_id: req.userId,
        name: updatedName,
        data: updatedData,
        created_at: existing.created_at,
        updated_at: now,
      },
    });
  } catch (error) {
    console.error('[Boards] Update error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

/**
 * DELETE /api/boards/:id
 * Delete a board.
 */
router.delete('/:id', async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    const result = await db.collection('boards').deleteOne({ _id: id as any, user_id: req.userId });

    if (result.deletedCount === 0) {
      res.status(404).json({ message: 'Board not found.' });
      return;
    }

    res.json({ message: 'Board deleted.' });
  } catch (error) {
    console.error('[Boards] Delete error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

export default router;
