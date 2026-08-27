import React, { createContext, useContext, useEffect, useState } from 'react';
import { getToken, saveToken, deleteToken } from '../lib/auth-store';

export interface UserSession {
  accessToken: string;
  refreshToken: string | null;
  userId: string;
  expiresAt: number;
}

interface AuthContextType {
  token: string | null;
  session: UserSession | null;
  isLoading: boolean;
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
const atob = (input: string = '') => {
  let str = input.replace(/=+$/, '');
  let output = '';
  for (let bc = 0, bs = 0, buffer, i = 0; buffer = str.charAt(i++); ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer, bc++ % 4) ? output += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0) {
    buffer = chars.indexOf(buffer);
  }
  return output;
};

function parseJwt(token: string) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [session, setSession] = useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load token on mount
    getToken().then((storedToken) => {
      if (storedToken) {
        setToken(storedToken);
        const decoded = parseJwt(storedToken);
        setSession({
          accessToken: storedToken,
          refreshToken: null,
          userId: decoded?.sub || decoded?.id || 'unknown',
          expiresAt: decoded?.exp ? decoded.exp * 1000 : 0,
        });
      }
      setIsLoading(false);
    });
  }, []);

  const signIn = async (newToken: string) => {
    await saveToken(newToken);
    setToken(newToken);
    const decoded = parseJwt(newToken);
    setSession({
      accessToken: newToken,
      refreshToken: null,
      userId: decoded?.sub || decoded?.id || 'unknown',
      expiresAt: decoded?.exp ? decoded.exp * 1000 : 0,
    });
  };

  const signOut = async () => {
    await deleteToken();
    setToken(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ token, session, isLoading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
