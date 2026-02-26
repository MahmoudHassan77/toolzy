import { Router, Request, Response, NextFunction } from 'express';
import { getDatabase } from '../db.js';
import { authMiddleware } from '../auth.js';

const router = Router();

// Admin middleware: requires auth + role === 'admin'
async function adminMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const db = getDatabase();
  const user = await db.collection('users').findOne({ _id: req.userId as any });
  if (!user || user.role !== 'admin') {
    res.status(403).json({ message: 'Admin access required.' });
    return;
  }
  next();
}

// All routes require auth + admin
router.use(authMiddleware, adminMiddleware);

const COLLECTIONS = ['notes', 'todos', 'boards', 'diagrams', 'calendar_events', 'links', 'applications', 'files'] as const;

/**
 * GET /api/admin/stats
 * Returns aggregate counts across all collections.
 */
router.get('/stats', async (_req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const [users, notes, todos, boards, diagrams, calendarEvents, links, applications] = await Promise.all([
      db.collection('users').countDocuments(),
      db.collection('notes').countDocuments(),
      db.collection('todos').countDocuments(),
      db.collection('boards').countDocuments(),
      db.collection('diagrams').countDocuments(),
      db.collection('calendar_events').countDocuments(),
      db.collection('links').countDocuments(),
      db.collection('applications').countDocuments(),
    ]);
    res.json({ stats: { users, notes, todos, boards, diagrams, calendarEvents, links, applications } });
  } catch (error) {
    console.error('[Admin] Stats error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

/**
 * GET /api/admin/users
 * List all users (paginated, searchable).
 * Query: ?page=1&limit=20&search=term
 */
router.get('/users', async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const search = (req.query.search as string || '').trim();

    const filter: Record<string, unknown> = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const [total, docs] = await Promise.all([
      db.collection('users').countDocuments(filter),
      db.collection('users')
        .find(filter, { projection: { password_hash: 0, provider_id: 0 } })
        .sort({ created_at: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
    ]);

    const users = docs.map(u => ({
      id: String(u._id),
      email: u.email,
      name: u.name,
      role: u.role || 'user',
      provider: u.provider,
      avatar_url: u.avatar_url ?? null,
      disabled: u.disabled ?? false,
      created_at: u.created_at,
    }));

    res.json({ users, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    console.error('[Admin] List users error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

/**
 * GET /api/admin/users/:id
 * Single user detail + content counts.
 */
router.get('/users/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const user = await db.collection('users').findOne(
      { _id: req.params.id as any },
      { projection: { password_hash: 0, provider_id: 0 } }
    );
    if (!user) { res.status(404).json({ message: 'User not found.' }); return; }

    const userId = String(user._id);
    const counts = await Promise.all(
      COLLECTIONS.map(c => db.collection(c).countDocuments({ user_id: userId }))
    );
    const contentCounts: Record<string, number> = {};
    COLLECTIONS.forEach((c, i) => { contentCounts[c] = counts[i]; });

    res.json({
      user: {
        id: userId,
        email: user.email,
        name: user.name,
        role: user.role || 'user',
        provider: user.provider,
        avatar_url: user.avatar_url ?? null,
        disabled: user.disabled ?? false,
        created_at: user.created_at,
      },
      contentCounts,
    });
  } catch (error) {
    console.error('[Admin] Get user error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

/**
 * PUT /api/admin/users/:id
 * Update user (role, name, disabled).
 */
router.put('/users/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const users = db.collection('users');
    const user = await users.findOne({ _id: req.params.id as any });
    if (!user) { res.status(404).json({ message: 'User not found.' }); return; }

    const { role, name, disabled } = req.body;
    const update: Record<string, unknown> = {};
    if (role !== undefined && (role === 'admin' || role === 'user')) update.role = role;
    if (name !== undefined && typeof name === 'string' && name.trim()) update.name = name.trim();
    if (disabled !== undefined && typeof disabled === 'boolean') update.disabled = disabled;

    if (Object.keys(update).length > 0) {
      await users.updateOne({ _id: req.params.id as any }, { $set: update });
    }

    const updated = await users.findOne(
      { _id: req.params.id as any },
      { projection: { password_hash: 0, provider_id: 0 } }
    );

    res.json({
      user: {
        id: String(updated!._id),
        email: updated!.email,
        name: updated!.name,
        role: updated!.role || 'user',
        provider: updated!.provider,
        avatar_url: updated!.avatar_url ?? null,
        disabled: updated!.disabled ?? false,
        created_at: updated!.created_at,
      },
    });
  } catch (error) {
    console.error('[Admin] Update user error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

/**
 * DELETE /api/admin/users/:id
 * Delete user + all their content.
 */
router.delete('/users/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const userId = req.params.id;

    // Prevent self-deletion
    if (userId === req.userId) {
      res.status(400).json({ message: 'Cannot delete your own account.' });
      return;
    }

    const user = await db.collection('users').findOne({ _id: userId as any });
    if (!user) { res.status(404).json({ message: 'User not found.' }); return; }

    // Delete all user content across collections
    await Promise.all(
      COLLECTIONS.map(c => db.collection(c).deleteMany({ user_id: userId }))
    );

    // Delete the user
    await db.collection('users').deleteOne({ _id: userId as any });

    res.json({ message: 'User and all content deleted.' });
  } catch (error) {
    console.error('[Admin] Delete user error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

/**
 * GET /api/admin/users/:id/content
 * List a user's content across all collections.
 */
router.get('/users/:id/content', async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const userId = req.params.id;

    const user = await db.collection('users').findOne({ _id: userId as any });
    if (!user) { res.status(404).json({ message: 'User not found.' }); return; }

    const results = await Promise.all(
      COLLECTIONS.map(async (c) => {
        const docs = await db.collection(c).find({ user_id: userId }).sort({ created_at: -1 }).limit(100).toArray();
        return [c, docs.map(d => ({ id: String(d._id), ...d, _id: undefined }))] as const;
      })
    );

    const content: Record<string, unknown[]> = {};
    results.forEach(([key, docs]) => { content[key] = docs; });

    res.json({ content });
  } catch (error) {
    console.error('[Admin] User content error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

/**
 * DELETE /api/admin/users/:id/content/:collection/:itemId
 * Delete specific content item.
 */
router.delete('/users/:id/content/:collection/:itemId', async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const { id: userId, collection, itemId } = req.params;

    if (!COLLECTIONS.includes(collection as any)) {
      res.status(400).json({ message: 'Invalid collection.' });
      return;
    }

    const result = await db.collection(collection).deleteOne({ _id: itemId as any, user_id: userId });
    if (result.deletedCount === 0) {
      res.status(404).json({ message: 'Content item not found.' });
      return;
    }

    res.json({ message: 'Content item deleted.' });
  } catch (error) {
    console.error('[Admin] Delete content error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

export default router;
