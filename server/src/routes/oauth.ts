import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../db.js';
import { generateToken } from '../auth.js';

const router = Router();

interface UserDoc {
  _id: string;
  email: string;
  name: string;
  provider: string;
  provider_id: string | null;
  avatar_url: string | null;
  created_at: string;
}

async function findOrCreateOAuthUser(
  provider: 'google' | 'github',
  providerId: string,
  email: string,
  name: string,
  avatarUrl: string | null
): Promise<{ token: string; user: { id: string; email: string; name: string; provider: string; avatar_url: string | null; created_at: string } }> {
  const db = getDatabase();
  const users = db.collection('users');

  // 1. Look up by provider + provider_id
  let user = await users.findOne({ provider, provider_id: providerId }) as UserDoc | null;

  if (!user) {
    // 2. Look up by email (link existing account)
    user = await users.findOne({ email }) as UserDoc | null;

    if (user) {
      // Link provider to existing email account
      await users.updateOne(
        { _id: user._id as any },
        { $set: { provider, provider_id: providerId, avatar_url: user.avatar_url ?? avatarUrl } }
      );
      user = { ...user, provider, provider_id: providerId, avatar_url: avatarUrl ?? user.avatar_url };
    }
  }

  if (!user) {
    // 3. Create new user
    const id = uuidv4();
    const createdAt = new Date().toISOString();
    await users.insertOne({
      _id: id as any,
      email,
      name,
      password_hash: null,
      provider,
      provider_id: providerId,
      avatar_url: avatarUrl,
      created_at: createdAt,
    });
    user = { _id: id, email, name, provider, provider_id: providerId, avatar_url: avatarUrl, created_at: createdAt };
  }

  const token = generateToken(user._id);
  return {
    token,
    user: { id: user._id, email: user.email, name: user.name, provider: user.provider, avatar_url: user.avatar_url, created_at: user.created_at },
  };
}

/**
 * POST /api/auth/google
 * Verify a Google id_token and return a JWT.
 */
router.post('/google', async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.body as { token?: string };
    if (!token) {
      res.status(400).json({ message: 'Google token is required.' });
      return;
    }

    // Verify the Google id_token
    const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`);
    if (!verifyRes.ok) {
      res.status(401).json({ message: 'Invalid Google token.' });
      return;
    }

    const payload = (await verifyRes.json()) as {
      sub: string;
      email: string;
      name?: string;
      picture?: string;
      aud: string;
    };

    const expectedClientId = process.env.GOOGLE_CLIENT_ID;
    if (expectedClientId && payload.aud !== expectedClientId) {
      res.status(401).json({ message: 'Token audience mismatch.' });
      return;
    }

    const result = await findOrCreateOAuthUser(
      'google',
      payload.sub,
      payload.email,
      payload.name || payload.email.split('@')[0],
      payload.picture || null
    );

    res.json(result);
  } catch (error) {
    console.error('[OAuth] Google auth error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

/**
 * POST /api/auth/github
 * Exchange a GitHub auth code for user info, then return a JWT.
 */
router.post('/github', async (req: Request, res: Response): Promise<void> => {
  try {
    const { code } = req.body as { code?: string };
    if (!code) {
      res.status(400).json({ message: 'GitHub authorization code is required.' });
      return;
    }

    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      res.status(500).json({ message: 'GitHub OAuth is not configured on the server.' });
      return;
    }

    // Exchange code for access token
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
    });

    const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string };
    if (!tokenData.access_token) {
      res.status(401).json({ message: tokenData.error || 'Failed to exchange GitHub code.' });
      return;
    }

    const ghHeaders = { Authorization: `Bearer ${tokenData.access_token}`, Accept: 'application/json' };

    // Fetch GitHub profile
    const profileRes = await fetch('https://api.github.com/user', { headers: ghHeaders });
    const profile = (await profileRes.json()) as {
      id: number;
      login: string;
      name: string | null;
      avatar_url: string;
      email: string | null;
    };

    // Fetch primary email if not public
    let email = profile.email;
    if (!email) {
      const emailsRes = await fetch('https://api.github.com/user/emails', { headers: ghHeaders });
      const emails = (await emailsRes.json()) as Array<{ email: string; primary: boolean; verified: boolean }>;
      const primary = emails.find((e) => e.primary && e.verified);
      email = primary?.email || emails[0]?.email || null;
    }

    if (!email) {
      res.status(400).json({ message: 'Could not retrieve email from GitHub. Please make your email public.' });
      return;
    }

    const result = await findOrCreateOAuthUser(
      'github',
      String(profile.id),
      email,
      profile.name || profile.login,
      profile.avatar_url || null
    );

    res.json(result);
  } catch (error) {
    console.error('[OAuth] GitHub auth error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

export default router;
