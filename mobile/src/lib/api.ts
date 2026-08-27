import { getToken } from './auth-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

export async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');

  const token = await getToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 10000); // 10s timeout

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
      signal: controller.signal
    });
    
    clearTimeout(id);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'API request failed');
    }

    return response.json();
  } catch (error: any) {
    clearTimeout(id);
    if (error.name === 'AbortError') {
      throw new Error('Request timed out. Please check your connection.');
    }
    // Handle standard network errors thrown by fetch
    if (error.message && (error.message.includes('Network request failed') || error.message.includes('Failed to fetch'))) {
      throw new Error('You appear to be offline. Please check your internet connection.');
    }
    throw error;
  }
}

export const api = {
  login: async (email: string, password: string) => {
    return fetchWithAuth('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },
  signup: async (email: string, password: string, firstName: string, lastName: string) => {
    return fetchWithAuth('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, firstName, lastName }),
    });
  },
  googleAuth: async (token: string) => {
    return fetchWithAuth('/api/v1/auth/google-auth', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  },
  getProfile: async () => {
    return fetchWithAuth('/api/v1/users/me');
  },
  getWorkspaces: async () => {
    return fetchWithAuth('/api/v1/workspaces');
  },
};
