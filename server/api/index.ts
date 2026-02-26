// Vercel Serverless Entry Point — single-file handler
// This re-exports the Express app for @vercel/node
// Using dynamic import to work around ESM module resolution in Vercel

import type { VercelRequest, VercelResponse } from '@vercel/node';

let handler: ((req: VercelRequest, res: VercelResponse) => void) | null = null;

export default async function (req: VercelRequest, res: VercelResponse) {
  if (!handler) {
    // Dynamically import dotenv and the app
    await import('dotenv/config');

    // Build the Express app inline to avoid cross-file ESM resolution issues
    const { MongoClient } = await import('mongodb');
    const bcrypt = (await import('bcryptjs')).default;
    const express = (await import('express')).default;
    const cors = (await import('cors')).default;
    const jwt = (await import('jsonwebtoken')).default;
    const { v4: uuidv4 } = await import('uuid');

    // --- Database ---
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI not set');
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db();

    // Indexes + seed (idempotent)
    const users = db.collection('users');
    await users.createIndex({ email: 1 }, { unique: true }).catch(() => {});
    await users.createIndex(
      { provider: 1, provider_id: 1 },
      { unique: true, partialFilterExpression: { provider_id: { $exists: true, $type: 'string' } } }
    ).catch(() => {});

    const demoUser = await users.findOne({ email: 'demo@demo.com' });
    if (!demoUser) {
      const hash = bcrypt.hashSync('demo123', 10);
      await users.insertOne({
        _id: 'demo-user-00000000' as any,
        email: 'demo@demo.com', password_hash: hash, name: 'Demo User', role: 'user',
        provider: 'email', provider_id: null, avatar_url: null,
        created_at: new Date().toISOString(),
      });
    }

    // Seed admin user
    const adminUser = await users.findOne({ email: 'admin@toolzy.com' });
    if (!adminUser) {
      const adminHash = bcrypt.hashSync('P@$$w0rd', 10);
      await users.insertOne({
        _id: 'admin-user-00000000' as any,
        email: 'admin@toolzy.com', password_hash: adminHash, name: 'Admin', role: 'admin',
        provider: 'email', provider_id: null, avatar_url: null,
        created_at: new Date().toISOString(),
      });
      console.log('[DB] Admin user created');
    }
    console.log('[DB] Connected to MongoDB Atlas');

    // --- Auth helpers ---
    const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
    const generateToken = (userId: string) => jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
    const hashPassword = (pw: string) => bcrypt.hash(pw, 10);
    const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);

    function authMiddleware(req: any, res: any, next: any) {
      const h = req.headers.authorization;
      if (!h || !h.startsWith('Bearer ')) { res.status(401).json({ message: 'Authentication required. Provide a Bearer token.' }); return; }
      try {
        const payload = jwt.verify(h.slice(7), JWT_SECRET) as any;
        req.userId = payload.userId;
        next();
      } catch { res.status(401).json({ message: 'Invalid or expired token.' }); }
    }

    // --- Express App ---
    const app = express();
    app.use(cors({
      origin: ['http://localhost:5173', 'https://toolzyhub.netlify.app', ...(process.env.CORS_ORIGIN ? [process.env.CORS_ORIGIN] : [])],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }));
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true }));

    // --- Auth Routes ---
    const authRouter = express.Router();
    authRouter.post('/register', async (req: any, res: any) => {
      try {
        const { email, password, name } = req.body;
        if (!email || !password || !name) { res.status(400).json({ message: 'Email, password, and name are required.' }); return; }
        if (typeof email !== 'string' || !email.includes('@')) { res.status(400).json({ message: 'A valid email address is required.' }); return; }
        if (typeof password !== 'string' || password.length < 6) { res.status(400).json({ message: 'Password must be at least 6 characters.' }); return; }
        if (typeof name !== 'string' || name.trim().length === 0) { res.status(400).json({ message: 'Name is required.' }); return; }
        const existing = await users.findOne({ email });
        if (existing) { res.status(409).json({ message: 'An account with this email already exists.' }); return; }
        const id = uuidv4(); const pwHash = await hashPassword(password); const createdAt = new Date().toISOString();
        await users.insertOne({ _id: id as any, email, password_hash: pwHash, name: name.trim(), role: 'user', provider: 'email', provider_id: null, avatar_url: null, created_at: createdAt });
        res.status(201).json({ token: generateToken(id), user: { id, email, name: name.trim(), role: 'user', avatar_url: null, created_at: createdAt } });
      } catch (e) { console.error('[Auth] Register error:', e); res.status(500).json({ message: 'Internal server error.' }); }
    });

    authRouter.post('/login', async (req: any, res: any) => {
      try {
        const { email, password } = req.body;
        if (!email || !password) { res.status(400).json({ message: 'Email and password are required.' }); return; }
        const user = await users.findOne({ email });
        if (!user) { res.status(401).json({ message: 'Invalid email or password.' }); return; }
        const valid = await verifyPassword(password, user.password_hash);
        if (!valid) { res.status(401).json({ message: 'Invalid email or password.' }); return; }
        res.json({ token: generateToken(String(user._id)), user: { id: String(user._id), email: user.email, name: user.name, role: user.role || 'user', avatar_url: user.avatar_url ?? null, created_at: user.created_at } });
      } catch (e) { console.error('[Auth] Login error:', e); res.status(500).json({ message: 'Internal server error.' }); }
    });

    authRouter.get('/me', authMiddleware, async (req: any, res: any) => {
      try {
        const user = await users.findOne({ _id: req.userId as any }, { projection: { password_hash: 0, provider_id: 0 } });
        if (!user) { res.status(404).json({ message: 'User not found.' }); return; }
        res.json({ user: { id: user._id, email: user.email, name: user.name, role: user.role || 'user', avatar_url: user.avatar_url ?? null, created_at: user.created_at } });
      } catch (e) { console.error('[Auth] Me error:', e); res.status(500).json({ message: 'Internal server error.' }); }
    });

    // --- OAuth Routes ---
    async function findOrCreateOAuthUser(provider: string, providerId: string, email: string, name: string, avatarUrl: string | null) {
      let user = await users.findOne({ provider, provider_id: providerId });
      if (!user) {
        user = await users.findOne({ email });
        if (user) {
          await users.updateOne({ _id: user._id }, { $set: { provider, provider_id: providerId, avatar_url: user.avatar_url ?? avatarUrl } });
          user = { ...user, provider, provider_id: providerId, avatar_url: avatarUrl ?? user.avatar_url };
        }
      }
      if (!user) {
        const id = uuidv4(); const createdAt = new Date().toISOString();
        await users.insertOne({ _id: id as any, email, name, password_hash: null, provider, provider_id: providerId, avatar_url: avatarUrl, created_at: createdAt });
        user = { _id: id, email, name, provider, provider_id: providerId, avatar_url: avatarUrl, created_at: createdAt };
      }
      return { token: generateToken(String(user._id)), user: { id: String(user._id), email: user.email, name: user.name, provider: user.provider, avatar_url: user.avatar_url, created_at: user.created_at } };
    }

    authRouter.post('/google', async (req: any, res: any) => {
      try {
        const { token } = req.body;
        if (!token) { res.status(400).json({ message: 'Google token is required.' }); return; }
        const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`);
        if (!verifyRes.ok) { res.status(401).json({ message: 'Invalid Google token.' }); return; }
        const payload = await verifyRes.json() as any;
        const expectedClientId = process.env.GOOGLE_CLIENT_ID;
        if (expectedClientId && payload.aud !== expectedClientId) { res.status(401).json({ message: 'Token audience mismatch.' }); return; }
        res.json(await findOrCreateOAuthUser('google', payload.sub, payload.email, payload.name || payload.email.split('@')[0], payload.picture || null));
      } catch (e) { console.error('[OAuth] Google error:', e); res.status(500).json({ message: 'Internal server error.' }); }
    });

    authRouter.post('/github', async (req: any, res: any) => {
      try {
        const { code } = req.body;
        if (!code) { res.status(400).json({ message: 'GitHub authorization code is required.' }); return; }
        const clientId = process.env.GITHUB_CLIENT_ID; const clientSecret = process.env.GITHUB_CLIENT_SECRET;
        if (!clientId || !clientSecret) { res.status(500).json({ message: 'GitHub OAuth is not configured on the server.' }); return; }
        const tokenRes = await fetch('https://github.com/login/oauth/access_token', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }) });
        const tokenData = await tokenRes.json() as any;
        if (!tokenData.access_token) { res.status(401).json({ message: tokenData.error || 'Failed to exchange GitHub code.' }); return; }
        const ghHeaders = { Authorization: `Bearer ${tokenData.access_token}`, Accept: 'application/json' };
        const profile = await (await fetch('https://api.github.com/user', { headers: ghHeaders })).json() as any;
        let email = profile.email;
        if (!email) { const emails = await (await fetch('https://api.github.com/user/emails', { headers: ghHeaders })).json() as any[]; const primary = emails.find(e => e.primary && e.verified); email = primary?.email || emails[0]?.email || null; }
        if (!email) { res.status(400).json({ message: 'Could not retrieve email from GitHub.' }); return; }
        res.json(await findOrCreateOAuthUser('github', String(profile.id), email, profile.name || profile.login, profile.avatar_url || null));
      } catch (e) { console.error('[OAuth] GitHub error:', e); res.status(500).json({ message: 'Internal server error.' }); }
    });

    app.use('/api/auth', authRouter);

    // --- Generic CRUD helper ---
    function crudRouter(collectionName: string, opts: { dataField?: boolean; sortField?: string; sortDir?: 1 | -1; responseKey: string; rowTransform?: (d: any) => any }) {
      const r = express.Router();
      r.use(authMiddleware);
      const col = db.collection(collectionName);
      const sort: any = {}; sort[opts.sortField || 'updated_at'] = opts.sortDir || -1;
      const transform = opts.rowTransform || ((d: any) => { const { _id, ...rest } = d; return { id: _id, ...rest }; });

      r.get('/', async (req: any, res: any) => {
        try {
          const docs = await col.find({ user_id: req.userId }).sort(sort).toArray();
          res.json({ [opts.responseKey]: docs.map(transform) });
        } catch (e) { console.error(`[${collectionName}] List error:`, e); res.status(500).json({ message: 'Internal server error.' }); }
      });
      return { router: r, col, transform };
    }

    // --- Boards ---
    const { router: boardsR, col: boardsCol } = crudRouter('boards', { responseKey: 'boards' });
    boardsR.post('/', async (req: any, res: any) => {
      try {
        const { name, data } = req.body;
        if (!name || typeof name !== 'string' || name.trim().length === 0) { res.status(400).json({ message: 'Board name is required.' }); return; }
        const id = uuidv4(); const now = new Date().toISOString();
        await boardsCol.insertOne({ _id: id as any, user_id: req.userId, name: name.trim(), data: data ?? {}, created_at: now, updated_at: now });
        res.status(201).json({ board: { id, user_id: req.userId, name: name.trim(), data: data ?? {}, created_at: now, updated_at: now } });
      } catch (e) { console.error('[Boards] Create error:', e); res.status(500).json({ message: 'Internal server error.' }); }
    });
    boardsR.put('/:id', async (req: any, res: any) => {
      try {
        const { id } = req.params; const { name, data } = req.body;
        const existing = await boardsCol.findOne({ _id: id as any, user_id: req.userId });
        if (!existing) { res.status(404).json({ message: 'Board not found.' }); return; }
        const now = new Date().toISOString();
        const updName = name !== undefined ? (typeof name === 'string' ? name.trim() : existing.name) : existing.name;
        const updData = data !== undefined ? data : existing.data;
        await boardsCol.updateOne({ _id: id as any, user_id: req.userId }, { $set: { name: updName, data: updData, updated_at: now } });
        res.json({ board: { id, user_id: req.userId, name: updName, data: updData, created_at: existing.created_at, updated_at: now } });
      } catch (e) { console.error('[Boards] Update error:', e); res.status(500).json({ message: 'Internal server error.' }); }
    });
    boardsR.delete('/:id', async (req: any, res: any) => {
      try {
        const result = await boardsCol.deleteOne({ _id: req.params.id as any, user_id: req.userId });
        if (result.deletedCount === 0) { res.status(404).json({ message: 'Board not found.' }); return; }
        res.json({ message: 'Board deleted.' });
      } catch (e) { console.error('[Boards] Delete error:', e); res.status(500).json({ message: 'Internal server error.' }); }
    });
    app.use('/api/boards', boardsR);

    // --- Diagrams ---
    const { router: diagramsR, col: diagramsCol } = crudRouter('diagrams', { responseKey: 'diagrams' });
    diagramsR.post('/', async (req: any, res: any) => {
      try {
        const { name, data } = req.body;
        if (!name || typeof name !== 'string' || name.trim().length === 0) { res.status(400).json({ message: 'Diagram name is required.' }); return; }
        const id = uuidv4(); const now = new Date().toISOString();
        await diagramsCol.insertOne({ _id: id as any, user_id: req.userId, name: name.trim(), data: data ?? {}, created_at: now, updated_at: now });
        res.status(201).json({ diagram: { id, user_id: req.userId, name: name.trim(), data: data ?? {}, created_at: now, updated_at: now } });
      } catch (e) { console.error('[Diagrams] Create error:', e); res.status(500).json({ message: 'Internal server error.' }); }
    });
    diagramsR.put('/:id', async (req: any, res: any) => {
      try {
        const { id } = req.params; const { name, data } = req.body;
        const existing = await diagramsCol.findOne({ _id: id as any, user_id: req.userId });
        if (!existing) { res.status(404).json({ message: 'Diagram not found.' }); return; }
        const now = new Date().toISOString();
        const updName = name !== undefined ? (typeof name === 'string' ? name.trim() : existing.name) : existing.name;
        const updData = data !== undefined ? data : existing.data;
        await diagramsCol.updateOne({ _id: id as any, user_id: req.userId }, { $set: { name: updName, data: updData, updated_at: now } });
        res.json({ diagram: { id, user_id: req.userId, name: updName, data: updData, created_at: existing.created_at, updated_at: now } });
      } catch (e) { console.error('[Diagrams] Update error:', e); res.status(500).json({ message: 'Internal server error.' }); }
    });
    diagramsR.delete('/:id', async (req: any, res: any) => {
      try {
        const result = await diagramsCol.deleteOne({ _id: req.params.id as any, user_id: req.userId });
        if (result.deletedCount === 0) { res.status(404).json({ message: 'Diagram not found.' }); return; }
        res.json({ message: 'Diagram deleted.' });
      } catch (e) { console.error('[Diagrams] Delete error:', e); res.status(500).json({ message: 'Internal server error.' }); }
    });
    app.use('/api/diagrams', diagramsR);

    // --- Notes ---
    const notesCol = db.collection('notes');
    const notesR = express.Router(); notesR.use(authMiddleware);
    notesR.get('/', async (req: any, res: any) => {
      try {
        const docs = await notesCol.find({ user_id: req.userId }).sort({ updated_at: -1 }).toArray();
        res.json({ notes: docs.map(d => ({ id: d._id, user_id: d.user_id, title: d.title, content: d.content, updated_at: d.updated_at, created_at: d.created_at })) });
      } catch (e) { console.error('[Notes] List error:', e); res.status(500).json({ message: 'Internal server error.' }); }
    });
    notesR.post('/', async (req: any, res: any) => {
      try {
        const { id, title, content, updatedAt } = req.body;
        const noteId = id || uuidv4(); const now = updatedAt || new Date().toISOString();
        await notesCol.updateOne({ _id: noteId as any }, { $set: { user_id: req.userId, title: title ?? 'Untitled', content: content ?? '', updated_at: now, created_at: now } }, { upsert: true });
        res.status(201).json({ note: { id: noteId, user_id: req.userId, title: title ?? 'Untitled', content: content ?? '', updated_at: now, created_at: now } });
      } catch (e) { console.error('[Notes] Create error:', e); res.status(500).json({ message: 'Internal server error.' }); }
    });
    notesR.put('/:id', async (req: any, res: any) => {
      try {
        const { id } = req.params; const { title, content } = req.body;
        const existing = await notesCol.findOne({ _id: id as any, user_id: req.userId });
        if (!existing) { res.status(404).json({ message: 'Note not found.' }); return; }
        const now = new Date().toISOString();
        await notesCol.updateOne({ _id: id as any, user_id: req.userId }, { $set: { title: title !== undefined ? title : existing.title, content: content !== undefined ? content : existing.content, updated_at: now } });
        res.json({ note: { id: existing._id, user_id: existing.user_id, title: title !== undefined ? title : existing.title, content: content !== undefined ? content : existing.content, updated_at: now, created_at: existing.created_at } });
      } catch (e) { console.error('[Notes] Update error:', e); res.status(500).json({ message: 'Internal server error.' }); }
    });
    notesR.delete('/:id', async (req: any, res: any) => {
      try {
        const result = await notesCol.deleteOne({ _id: req.params.id as any, user_id: req.userId });
        if (result.deletedCount === 0) { res.status(404).json({ message: 'Note not found.' }); return; }
        res.json({ message: 'Note deleted.' });
      } catch (e) { console.error('[Notes] Delete error:', e); res.status(500).json({ message: 'Internal server error.' }); }
    });
    notesR.post('/sync', async (req: any, res: any) => {
      try {
        const { notes } = req.body;
        if (!Array.isArray(notes)) { res.status(400).json({ message: 'notes array required.' }); return; }
        if (notes.length > 0) { await notesCol.bulkWrite(notes.map((n: any) => ({ updateOne: { filter: { _id: n.id as any }, update: { $set: { user_id: req.userId, title: n.title, content: n.content, updated_at: new Date(n.updatedAt).toISOString(), created_at: new Date(n.updatedAt).toISOString() } }, upsert: true } }))); }
        const docs = await notesCol.find({ user_id: req.userId }).sort({ updated_at: -1 }).toArray();
        res.json({ notes: docs.map(d => ({ id: d._id, user_id: d.user_id, title: d.title, content: d.content, updated_at: d.updated_at, created_at: d.created_at })) });
      } catch (e) { console.error('[Notes] Sync error:', e); res.status(500).json({ message: 'Internal server error.' }); }
    });
    app.use('/api/notes', notesR);

    // --- Todos ---
    const todosCol = db.collection('todos');
    const todosR = express.Router(); todosR.use(authMiddleware);
    const docToTodo = (d: any) => ({ id: d._id, text: d.text, done: !!d.done, priority: d.priority, dueDate: d.due_date ?? undefined, createdAt: new Date(d.created_at).getTime() });
    todosR.get('/', async (req: any, res: any) => {
      try { const docs = await todosCol.find({ user_id: req.userId }).sort({ created_at: -1 }).toArray(); res.json({ todos: docs.map(docToTodo) }); }
      catch (e) { console.error('[Todos] List error:', e); res.status(500).json({ message: 'Internal server error.' }); }
    });
    todosR.post('/', async (req: any, res: any) => {
      try {
        const { id, text, done, priority, dueDate, createdAt } = req.body;
        if (!text) { res.status(400).json({ message: 'text is required.' }); return; }
        const todoId = id || uuidv4(); const now = createdAt ? new Date(createdAt).toISOString() : new Date().toISOString();
        await todosCol.updateOne({ _id: todoId as any }, { $set: { user_id: req.userId, text, done: done ?? false, priority: priority ?? 'medium', due_date: dueDate ?? null, created_at: now } }, { upsert: true });
        res.status(201).json({ todo: { id: todoId, text, done: done ?? false, priority: priority ?? 'medium', dueDate, createdAt: new Date(now).getTime() } });
      } catch (e) { console.error('[Todos] Create error:', e); res.status(500).json({ message: 'Internal server error.' }); }
    });
    todosR.put('/:id', async (req: any, res: any) => {
      try {
        const { id } = req.params; const { text, done, priority, dueDate } = req.body;
        const existing = await todosCol.findOne({ _id: id as any, user_id: req.userId });
        if (!existing) { res.status(404).json({ message: 'Todo not found.' }); return; }
        const u = { text: text !== undefined ? text : existing.text, done: done !== undefined ? done : existing.done, priority: priority !== undefined ? priority : existing.priority, due_date: dueDate !== undefined ? dueDate : existing.due_date };
        await todosCol.updateOne({ _id: id as any, user_id: req.userId }, { $set: u });
        res.json({ todo: { id, text: u.text, done: !!u.done, priority: u.priority, dueDate: u.due_date ?? undefined, createdAt: new Date(existing.created_at).getTime() } });
      } catch (e) { console.error('[Todos] Update error:', e); res.status(500).json({ message: 'Internal server error.' }); }
    });
    todosR.delete('/:id', async (req: any, res: any) => {
      try {
        const result = await todosCol.deleteOne({ _id: req.params.id as any, user_id: req.userId });
        if (result.deletedCount === 0) { res.status(404).json({ message: 'Todo not found.' }); return; }
        res.json({ message: 'Todo deleted.' });
      } catch (e) { console.error('[Todos] Delete error:', e); res.status(500).json({ message: 'Internal server error.' }); }
    });
    todosR.post('/sync', async (req: any, res: any) => {
      try {
        const { todos } = req.body;
        if (!Array.isArray(todos)) { res.status(400).json({ message: 'todos array required.' }); return; }
        if (todos.length > 0) { await todosCol.bulkWrite(todos.map((t: any) => ({ updateOne: { filter: { _id: t.id as any }, update: { $set: { user_id: req.userId, text: t.text, done: t.done, priority: t.priority, due_date: t.dueDate ?? null, created_at: new Date(t.createdAt).toISOString() } }, upsert: true } }))); }
        const docs = await todosCol.find({ user_id: req.userId }).sort({ created_at: -1 }).toArray();
        res.json({ todos: docs.map(docToTodo) });
      } catch (e) { console.error('[Todos] Sync error:', e); res.status(500).json({ message: 'Internal server error.' }); }
    });
    app.use('/api/todos', todosR);

    // --- Calendar ---
    const calCol = db.collection('calendar_events');
    const calR = express.Router(); calR.use(authMiddleware);
    const evtMap = (d: any) => ({ id: d._id, user_id: d.user_id, title: d.title, date: d.date, time: d.time, color: d.color, description: d.description, created_at: d.created_at });
    calR.get('/', async (req: any, res: any) => {
      try { const docs = await calCol.find({ user_id: req.userId }).sort({ date: 1, time: 1 }).toArray(); res.json({ events: docs.map(evtMap) }); }
      catch (e) { console.error('[Calendar] List error:', e); res.status(500).json({ message: 'Internal server error.' }); }
    });
    calR.post('/', async (req: any, res: any) => {
      try {
        const { id, title, date, time, color, description } = req.body;
        if (!title || !date) { res.status(400).json({ message: 'title and date are required.' }); return; }
        const eventId = id || uuidv4(); const now = new Date().toISOString();
        await calCol.updateOne({ _id: eventId as any }, { $set: { user_id: req.userId, title, date, time: time ?? null, color: color ?? '#3b82f6', description: description ?? '', created_at: now } }, { upsert: true });
        res.status(201).json({ event: { id: eventId, user_id: req.userId, title, date, time: time ?? null, color: color ?? '#3b82f6', description: description ?? '', created_at: now } });
      } catch (e) { console.error('[Calendar] Create error:', e); res.status(500).json({ message: 'Internal server error.' }); }
    });
    calR.put('/:id', async (req: any, res: any) => {
      try {
        const { id } = req.params; const { title, date, time, color, description } = req.body;
        const existing = await calCol.findOne({ _id: id as any, user_id: req.userId });
        if (!existing) { res.status(404).json({ message: 'Event not found.' }); return; }
        const upd = { title: title ?? existing.title, date: date ?? existing.date, time: time !== undefined ? time : existing.time, color: color ?? existing.color, description: description !== undefined ? description : existing.description };
        await calCol.updateOne({ _id: id as any, user_id: req.userId }, { $set: upd });
        res.json({ event: { id: existing._id, user_id: existing.user_id, ...upd, created_at: existing.created_at } });
      } catch (e) { console.error('[Calendar] Update error:', e); res.status(500).json({ message: 'Internal server error.' }); }
    });
    calR.delete('/:id', async (req: any, res: any) => {
      try {
        const result = await calCol.deleteOne({ _id: req.params.id as any, user_id: req.userId });
        if (result.deletedCount === 0) { res.status(404).json({ message: 'Event not found.' }); return; }
        res.json({ message: 'Event deleted.' });
      } catch (e) { console.error('[Calendar] Delete error:', e); res.status(500).json({ message: 'Internal server error.' }); }
    });
    calR.post('/sync', async (req: any, res: any) => {
      try {
        const { events } = req.body;
        if (!Array.isArray(events)) { res.status(400).json({ message: 'events array required.' }); return; }
        if (events.length > 0) { await calCol.bulkWrite(events.map((e: any) => ({ updateOne: { filter: { _id: e.id as any }, update: { $set: { user_id: req.userId, title: e.title, date: e.date, time: e.time ?? null, color: e.color ?? '#3b82f6', description: e.description ?? '', created_at: e.created_at || new Date().toISOString() } }, upsert: true } }))); }
        const docs = await calCol.find({ user_id: req.userId }).sort({ date: 1, time: 1 }).toArray();
        res.json({ events: docs.map(evtMap) });
      } catch (e) { console.error('[Calendar] Sync error:', e); res.status(500).json({ message: 'Internal server error.' }); }
    });
    app.use('/api/calendar', calR);

    // --- Applications ---
    const appsCol = db.collection('applications');
    const appsR = express.Router(); appsR.use(authMiddleware);
    appsR.get('/', async (req: any, res: any) => {
      try { const docs = await appsCol.find({ user_id: req.userId }).sort({ updated_at: -1 }).toArray(); res.json({ applications: docs.map(r => ({ ...r.data, id: r._id })) }); }
      catch (e) { console.error('[Applications] List error:', e); res.status(500).json({ message: 'Internal server error.' }); }
    });
    appsR.post('/', async (req: any, res: any) => {
      try {
        const appData = req.body; if (!appData || !appData.id) { res.status(400).json({ message: 'Application with id required.' }); return; }
        const now = new Date().toISOString();
        await appsCol.updateOne({ _id: appData.id as any }, { $set: { user_id: req.userId, data: appData, created_at: now, updated_at: now } }, { upsert: true });
        res.status(201).json({ application: appData });
      } catch (e) { console.error('[Applications] Create error:', e); res.status(500).json({ message: 'Internal server error.' }); }
    });
    appsR.put('/:id', async (req: any, res: any) => {
      try {
        const { id } = req.params; const patch = req.body;
        const existing = await appsCol.findOne({ _id: id as any, user_id: req.userId });
        if (!existing) { res.status(404).json({ message: 'Application not found.' }); return; }
        const merged = { ...existing.data, ...patch, id }; const now = new Date().toISOString();
        await appsCol.updateOne({ _id: id as any, user_id: req.userId }, { $set: { data: merged, updated_at: now } });
        res.json({ application: merged });
      } catch (e) { console.error('[Applications] Update error:', e); res.status(500).json({ message: 'Internal server error.' }); }
    });
    appsR.delete('/:id', async (req: any, res: any) => {
      try {
        const result = await appsCol.deleteOne({ _id: req.params.id as any, user_id: req.userId });
        if (result.deletedCount === 0) { res.status(404).json({ message: 'Application not found.' }); return; }
        res.json({ message: 'Application deleted.' });
      } catch (e) { console.error('[Applications] Delete error:', e); res.status(500).json({ message: 'Internal server error.' }); }
    });
    appsR.post('/sync', async (req: any, res: any) => {
      try {
        const { applications } = req.body;
        if (!Array.isArray(applications)) { res.status(400).json({ message: 'applications array required.' }); return; }
        if (applications.length > 0) { await appsCol.bulkWrite(applications.map((a: any) => ({ updateOne: { filter: { _id: a.id as any }, update: { $set: { user_id: req.userId, data: a, created_at: (a.createdAt as string) || new Date().toISOString(), updated_at: (a.updatedAt as string) || new Date().toISOString() } }, upsert: true } }))); }
        const docs = await appsCol.find({ user_id: req.userId }).sort({ updated_at: -1 }).toArray();
        res.json({ applications: docs.map(r => ({ ...r.data, id: r._id })) });
      } catch (e) { console.error('[Applications] Sync error:', e); res.status(500).json({ message: 'Internal server error.' }); }
    });
    app.use('/api/applications', appsR);

    // --- Links ---
    const linksCol = db.collection('links');
    const linksR = express.Router(); linksR.use(authMiddleware);
    const linkMap = (d: any) => ({ id: d._id, url: d.url, title: d.title, category: d.category, description: d.description, tags: d.tags, favicon: d.favicon, updated_at: d.updated_at, created_at: d.created_at });
    linksR.get('/', async (req: any, res: any) => {
      try { const docs = await linksCol.find({ user_id: req.userId }).sort({ updated_at: -1 }).toArray(); res.json({ links: docs.map(linkMap) }); }
      catch (e) { console.error('[Links] List error:', e); res.status(500).json({ message: 'Internal server error.' }); }
    });
    linksR.delete('/:id', async (req: any, res: any) => {
      try {
        const result = await linksCol.deleteOne({ _id: req.params.id as any, user_id: req.userId });
        if (result.deletedCount === 0) { res.status(404).json({ message: 'Link not found.' }); return; }
        res.json({ message: 'Link deleted.' });
      } catch (e) { console.error('[Links] Delete error:', e); res.status(500).json({ message: 'Internal server error.' }); }
    });
    linksR.post('/sync', async (req: any, res: any) => {
      try {
        const { links } = req.body;
        if (!Array.isArray(links)) { res.status(400).json({ message: 'links array required.' }); return; }
        if (links.length > 0) {
          await linksCol.bulkWrite(links.map((l: any) => ({
            updateOne: {
              filter: { _id: l.id as any },
              update: { $set: { user_id: req.userId, url: l.url, title: l.title, category: l.category, description: l.description, tags: JSON.stringify(l.tags), favicon: l.favicon, updated_at: new Date(l.updatedAt).toISOString(), created_at: new Date(l.createdAt).toISOString() } },
              upsert: true,
            },
          })));
        }
        const docs = await linksCol.find({ user_id: req.userId }).sort({ updated_at: -1 }).toArray();
        res.json({ links: docs.map(linkMap) });
      } catch (e) { console.error('[Links] Sync error:', e); res.status(500).json({ message: 'Internal server error.' }); }
    });
    app.use('/api/links', linksR);

    // --- Files (metadata only on serverless — no disk uploads) ---
    const filesR = express.Router(); filesR.use(authMiddleware);
    const filesCol = db.collection('files');
    filesR.get('/:id', async (req: any, res: any) => {
      try {
        const file = await filesCol.findOne({ _id: req.params.id as any, user_id: req.userId });
        if (!file) { res.status(404).json({ message: 'File not found.' }); return; }
        res.json({ file: { id: file._id, filename: file.filename, mimetype: file.mimetype, size: file.size, created_at: file.created_at } });
      } catch (e) { console.error('[Files] Get error:', e); res.status(500).json({ message: 'Internal server error.' }); }
    });
    app.use('/api/files', filesR);

    // --- Admin Routes ---
    const ADMIN_COLLECTIONS = ['notes', 'todos', 'boards', 'diagrams', 'calendar_events', 'links', 'applications', 'files'];
    function adminMiddleware(req: any, res: any, next: any) {
      // Runs after authMiddleware
      users.findOne({ _id: req.userId as any }).then((user: any) => {
        if (!user || user.role !== 'admin') { res.status(403).json({ message: 'Admin access required.' }); return; }
        next();
      }).catch(() => { res.status(500).json({ message: 'Internal server error.' }); });
    }
    const adminR = express.Router(); adminR.use(authMiddleware, adminMiddleware);

    adminR.get('/stats', async (_req: any, res: any) => {
      try {
        const [usersCount, notesCount, todosCount, boardsCount, diagramsCount, calEventsCount, linksCount, appsCount] = await Promise.all([
          db.collection('users').countDocuments(), db.collection('notes').countDocuments(), db.collection('todos').countDocuments(),
          db.collection('boards').countDocuments(), db.collection('diagrams').countDocuments(), db.collection('calendar_events').countDocuments(),
          db.collection('links').countDocuments(), db.collection('applications').countDocuments(),
        ]);
        res.json({ stats: { users: usersCount, notes: notesCount, todos: todosCount, boards: boardsCount, diagrams: diagramsCount, calendarEvents: calEventsCount, links: linksCount, applications: appsCount } });
      } catch (e) { console.error('[Admin] Stats error:', e); res.status(500).json({ message: 'Internal server error.' }); }
    });

    adminR.get('/users', async (req: any, res: any) => {
      try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
        const search = (req.query.search || '').trim();
        const filter: any = {};
        if (search) { filter.$or = [{ name: { $regex: search, $options: 'i' } }, { email: { $regex: search, $options: 'i' } }]; }
        const [total, docs] = await Promise.all([
          db.collection('users').countDocuments(filter),
          db.collection('users').find(filter, { projection: { password_hash: 0, provider_id: 0 } }).sort({ created_at: -1 }).skip((page - 1) * limit).limit(limit).toArray(),
        ]);
        const userList = docs.map((u: any) => ({ id: String(u._id), email: u.email, name: u.name, role: u.role || 'user', provider: u.provider, avatar_url: u.avatar_url ?? null, disabled: u.disabled ?? false, created_at: u.created_at }));
        res.json({ users: userList, total, page, limit, totalPages: Math.ceil(total / limit) });
      } catch (e) { console.error('[Admin] List users error:', e); res.status(500).json({ message: 'Internal server error.' }); }
    });

    adminR.get('/users/:id', async (req: any, res: any) => {
      try {
        const user = await db.collection('users').findOne({ _id: req.params.id as any }, { projection: { password_hash: 0, provider_id: 0 } });
        if (!user) { res.status(404).json({ message: 'User not found.' }); return; }
        const userId = String(user._id);
        const counts = await Promise.all(ADMIN_COLLECTIONS.map(c => db.collection(c).countDocuments({ user_id: userId })));
        const contentCounts: any = {}; ADMIN_COLLECTIONS.forEach((c, i) => { contentCounts[c] = counts[i]; });
        res.json({ user: { id: userId, email: user.email, name: user.name, role: user.role || 'user', provider: user.provider, avatar_url: user.avatar_url ?? null, disabled: user.disabled ?? false, created_at: user.created_at }, contentCounts });
      } catch (e) { console.error('[Admin] Get user error:', e); res.status(500).json({ message: 'Internal server error.' }); }
    });

    adminR.put('/users/:id', async (req: any, res: any) => {
      try {
        const user = await users.findOne({ _id: req.params.id as any });
        if (!user) { res.status(404).json({ message: 'User not found.' }); return; }
        const { role, name, disabled } = req.body;
        const update: any = {};
        if (role !== undefined && (role === 'admin' || role === 'user')) update.role = role;
        if (name !== undefined && typeof name === 'string' && name.trim()) update.name = name.trim();
        if (disabled !== undefined && typeof disabled === 'boolean') update.disabled = disabled;
        if (Object.keys(update).length > 0) { await users.updateOne({ _id: req.params.id as any }, { $set: update }); }
        const updated = await users.findOne({ _id: req.params.id as any }, { projection: { password_hash: 0, provider_id: 0 } });
        res.json({ user: { id: String(updated._id), email: updated.email, name: updated.name, role: updated.role || 'user', provider: updated.provider, avatar_url: updated.avatar_url ?? null, disabled: updated.disabled ?? false, created_at: updated.created_at } });
      } catch (e) { console.error('[Admin] Update user error:', e); res.status(500).json({ message: 'Internal server error.' }); }
    });

    adminR.delete('/users/:id', async (req: any, res: any) => {
      try {
        const userId = req.params.id;
        if (userId === req.userId) { res.status(400).json({ message: 'Cannot delete your own account.' }); return; }
        const user = await users.findOne({ _id: userId as any });
        if (!user) { res.status(404).json({ message: 'User not found.' }); return; }
        await Promise.all(ADMIN_COLLECTIONS.map(c => db.collection(c).deleteMany({ user_id: userId })));
        await users.deleteOne({ _id: userId as any });
        res.json({ message: 'User and all content deleted.' });
      } catch (e) { console.error('[Admin] Delete user error:', e); res.status(500).json({ message: 'Internal server error.' }); }
    });

    adminR.get('/users/:id/content', async (req: any, res: any) => {
      try {
        const userId = req.params.id;
        const user = await users.findOne({ _id: userId as any });
        if (!user) { res.status(404).json({ message: 'User not found.' }); return; }
        const results = await Promise.all(ADMIN_COLLECTIONS.map(async (c) => {
          const docs = await db.collection(c).find({ user_id: userId }).sort({ created_at: -1 }).limit(100).toArray();
          return [c, docs.map((d: any) => ({ id: String(d._id), ...d, _id: undefined }))] as const;
        }));
        const content: any = {}; results.forEach(([key, docs]) => { content[key] = docs; });
        res.json({ content });
      } catch (e) { console.error('[Admin] User content error:', e); res.status(500).json({ message: 'Internal server error.' }); }
    });

    adminR.delete('/users/:id/content/:collection/:itemId', async (req: any, res: any) => {
      try {
        const { id: userId, collection, itemId } = req.params;
        if (!ADMIN_COLLECTIONS.includes(collection)) { res.status(400).json({ message: 'Invalid collection.' }); return; }
        const result = await db.collection(collection).deleteOne({ _id: itemId as any, user_id: userId });
        if (result.deletedCount === 0) { res.status(404).json({ message: 'Content item not found.' }); return; }
        res.json({ message: 'Content item deleted.' });
      } catch (e) { console.error('[Admin] Delete content error:', e); res.status(500).json({ message: 'Internal server error.' }); }
    });

    app.use('/api/admin', adminR);

    // --- Health & fallbacks ---
    app.get('/api/health', (_req: any, res: any) => { res.json({ status: 'ok', timestamp: new Date().toISOString() }); });
    app.use('/api', (_req: any, res: any) => { res.status(404).json({ message: 'API endpoint not found.' }); });
    app.use((err: any, _req: any, res: any, _next: any) => { console.error('[Server] Unhandled error:', err); res.status(500).json({ message: 'Internal server error.' }); });

    handler = app as any;
  }

  return handler!(req, res);
}
