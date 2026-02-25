import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

interface User {
  id: string;
  email: string;
  name: string;
  avatar_url?: string | null;
  created_at: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loginWithGitHub: () => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = 'myservices_token';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const env = (import.meta as any).env || {};
const GOOGLE_CLIENT_ID = env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const GITHUB_CLIENT_ID = env.VITE_GITHUB_CLIENT_ID as string | undefined;

function handleAuthResponse(data: { token: string; user: User }) {
  localStorage.setItem(TOKEN_KEY, data.token);
  return { user: data.user, token: data.token, loading: false };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: localStorage.getItem(TOKEN_KEY),
    loading: true,
  });

  // On mount, validate the stored token by calling /api/auth/me
  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);

    if (!storedToken) {
      setState((prev) => ({ ...prev, loading: false }));
      return;
    }

    let cancelled = false;

    api
      .me()
      .then((data: { user: User }) => {
        if (!cancelled) {
          setState({
            user: data.user,
            token: storedToken,
            loading: false,
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          localStorage.removeItem(TOKEN_KEY);
          setState({ user: null, token: null, loading: false });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api.login(email, password);
    const result = data as { token: string; user: User };
    setState(handleAuthResponse(result));
  }, []);

  const register = useCallback(async (email: string, password: string, name: string) => {
    const data = await api.register(email, password, name);
    const result = data as { token: string; user: User };
    setState(handleAuthResponse(result));
  }, []);

  const loginWithGoogle = useCallback(async () => {
    if (!GOOGLE_CLIENT_ID) throw new Error('Google OAuth is not configured.');

    const credential = await new Promise<string>((resolve, reject) => {
      // Load Google Identity Services if not already loaded
      const loadGsi = () => {
        const g = (window as any).google; // eslint-disable-line @typescript-eslint/no-explicit-any
        if (!g?.accounts?.id) {
          reject(new Error('Google Identity Services failed to load.'));
          return;
        }
        g.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (response: { credential: string }) => {
            resolve(response.credential);
          },
        });
        g.accounts.id.prompt((notification: { isNotDisplayed: () => boolean; isSkippedMoment: () => boolean }) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            // Fallback: use popup button approach
            g.accounts.id.renderButton(document.createElement('div'), {
              type: 'standard',
            });
            // Use the popup method
            g.accounts.oauth2.initTokenFlow({
              client_id: GOOGLE_CLIENT_ID,
              scope: 'email profile',
              callback: () => {},
            });
          }
        });
      };

      if ((window as any).google?.accounts?.id) { // eslint-disable-line @typescript-eslint/no-explicit-any
        loadGsi();
      } else {
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.onload = loadGsi;
        script.onerror = () => reject(new Error('Failed to load Google Sign-In.'));
        document.head.appendChild(script);
      }
    });

    const data = await api.googleAuth(credential);
    const result = data as { token: string; user: User };
    setState(handleAuthResponse(result));
  }, []);

  const loginWithGitHub = useCallback(async () => {
    if (!GITHUB_CLIENT_ID) throw new Error('GitHub OAuth is not configured.');

    const code = await new Promise<string>((resolve, reject) => {
      const width = 500;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const popup = window.open(
        `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&scope=user:email`,
        'github-oauth',
        `width=${width},height=${height},left=${left},top=${top}`
      );

      if (!popup) {
        reject(new Error('Popup was blocked. Please allow popups for this site.'));
        return;
      }

      const handleMessage = (event: MessageEvent) => {
        if (event.data?.type === 'github-oauth-callback' && event.data?.code) {
          window.removeEventListener('message', handleMessage);
          resolve(event.data.code);
        }
      };
      window.addEventListener('message', handleMessage);

      // Check if popup was closed without completing
      const timer = setInterval(() => {
        if (popup.closed) {
          clearInterval(timer);
          window.removeEventListener('message', handleMessage);
          reject(new Error('GitHub login was cancelled.'));
        }
      }, 500);
    });

    const data = await api.githubAuth(code);
    const result = data as { token: string; user: User };
    setState(handleAuthResponse(result));
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setState({ user: null, token: null, loading: false });
  }, []);

  const value: AuthContextValue = {
    ...state,
    login,
    register,
    loginWithGoogle,
    loginWithGitHub,
    logout,
    isAuthenticated: !!state.user && !!state.token,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
