import { MongoClient, Db } from 'mongodb';
import bcrypt from 'bcryptjs';

let client: MongoClient | null = null;
let db: Db | null = null;
let initPromise: Promise<void> | null = null;

export async function initDatabase(): Promise<void> {
  // Return cached connection if already connected
  if (db) return;

  // Deduplicate concurrent init calls (important for serverless warm starts)
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error('MONGODB_URI environment variable is not set.');
    }

    client = new MongoClient(uri);
    await client.connect();
    db = client.db(); // database name is already in the URI ("toolzy")

    // Create indexes
    const users = db.collection('users');
    await users.createIndex({ email: 1 }, { unique: true });
    await users.createIndex(
      { provider: 1, provider_id: 1 },
      { unique: true, partialFilterExpression: { provider_id: { $exists: true, $type: 'string' } } }
    );

    // Seed demo user if not exists
    const demoUser = await users.findOne({ email: 'demo@demo.com' });
    if (!demoUser) {
      const hash = bcrypt.hashSync('demo123', 10);
      await users.insertOne({
        _id: 'demo-user-00000000' as any,
        email: 'demo@demo.com',
        password_hash: hash,
        name: 'Demo User',
        role: 'user',
        provider: 'email',
        provider_id: null,
        avatar_url: null,
        created_at: new Date().toISOString(),
      });
      console.log('[DB] Demo user created (email: demo@demo.com, password: demo123)');
    }

    // Seed admin user if not exists
    const adminUser = await users.findOne({ email: 'admin@toolzy.com' });
    if (!adminUser) {
      const adminHash = bcrypt.hashSync('P@$$w0rd', 10);
      await users.insertOne({
        _id: 'admin-user-00000000' as any,
        email: 'admin@toolzy.com',
        password_hash: adminHash,
        name: 'Admin',
        role: 'admin',
        provider: 'email',
        provider_id: null,
        avatar_url: null,
        created_at: new Date().toISOString(),
      });
      console.log('[DB] Admin user created (email: admin@toolzy.com)');
    }

    console.log('[DB] Connected to MongoDB Atlas');
  })();

  try {
    await initPromise;
  } catch (err) {
    // Reset so next call retries
    initPromise = null;
    client = null;
    db = null;
    throw err;
  }
}

export function getDatabase(): Db {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

export function getClient(): MongoClient {
  if (!client) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return client;
}
