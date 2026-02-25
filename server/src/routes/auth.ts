import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../db.js';
import { hashPassword, verifyPassword, generateToken, authMiddleware } from '../auth.js';

const router = Router();

interface RegisterBody {
  email?: string;
  password?: string;
  name?: string;
}

interface LoginBody {
  email?: string;
  password?: string;
}

/**
 * POST /api/auth/register
 * Create a new user account and return a JWT token.
 */
router.post('/register', async (req: Request<object, object, RegisterBody>, res: Response): Promise<void> => {
  try {
    const { email, password, name } = req.body;

    // Validate input
    if (!email || !password || !name) {
      res.status(400).json({ message: 'Email, password, and name are required.' });
      return;
    }

    if (typeof email !== 'string' || !email.includes('@')) {
      res.status(400).json({ message: 'A valid email address is required.' });
      return;
    }

    if (typeof password !== 'string' || password.length < 6) {
      res.status(400).json({ message: 'Password must be at least 6 characters.' });
      return;
    }

    if (typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ message: 'Name is required.' });
      return;
    }

    const db = getDatabase();
    const users = db.collection('users');

    // Check if email already exists
    const existing = await users.findOne({ email });
    if (existing) {
      res.status(409).json({ message: 'An account with this email already exists.' });
      return;
    }

    // Create the user
    const id = uuidv4();
    const passwordHash = await hashPassword(password);
    const createdAt = new Date().toISOString();

    await users.insertOne({
      _id: id as any,
      email,
      password_hash: passwordHash,
      name: name.trim(),
      provider: 'email',
      provider_id: null,
      avatar_url: null,
      created_at: createdAt,
    });

    // Generate token
    const token = generateToken(id);

    res.status(201).json({
      token,
      user: { id, email, name: name.trim(), avatar_url: null, created_at: createdAt },
    });
  } catch (error) {
    console.error('[Auth] Register error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

/**
 * POST /api/auth/login
 * Authenticate with email + password and return a JWT token.
 */
router.post('/login', async (req: Request<object, object, LoginBody>, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ message: 'Email and password are required.' });
      return;
    }

    const db = getDatabase();
    const users = db.collection('users');
    const user = await users.findOne({ email });

    if (!user) {
      res.status(401).json({ message: 'Invalid email or password.' });
      return;
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ message: 'Invalid email or password.' });
      return;
    }

    const token = generateToken(String(user._id));

    res.json({
      token,
      user: { id: String(user._id), email: user.email, name: user.name, avatar_url: user.avatar_url ?? null, created_at: user.created_at },
    });
  } catch (error) {
    console.error('[Auth] Login error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

/**
 * GET /api/auth/me
 * Return the current authenticated user's profile.
 */
router.get('/me', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDatabase();
    const users = db.collection('users');
    const user = await users.findOne(
      { _id: req.userId as any },
      { projection: { password_hash: 0, provider_id: 0 } }
    );

    if (!user) {
      res.status(404).json({ message: 'User not found.' });
      return;
    }

    res.json({ user: { id: user._id, email: user.email, name: user.name, avatar_url: user.avatar_url ?? null, created_at: user.created_at } });
  } catch (error) {
    console.error('[Auth] Me error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

export default router;
