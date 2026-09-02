import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'mako_session_token';
const REFRESH_TOKEN_KEY = 'mako_refresh_token';
const WORKSPACE_KEY = 'mako_active_workspace';
const TENANT_KEY = 'mako_active_tenant';

async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(key);
}

async function setItem(key: string, value: string) {
  if (Platform.OS === 'web') {
    localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function deleteItem(key: string) {
  try {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  } catch {
    // ignore missing keys
  }
}

export async function saveToken(token: string) {
  await setItem(ACCESS_TOKEN_KEY, token);
}

export async function getToken() {
  try {
    return await getItem(ACCESS_TOKEN_KEY);
  } catch (error) {
    console.error('Failed to get the token from secure store', error);
    return null;
  }
}

export async function deleteToken() {
  await deleteItem(ACCESS_TOKEN_KEY);
}

export async function saveRefreshToken(token: string | null) {
  if (!token) {
    await deleteItem(REFRESH_TOKEN_KEY);
    return;
  }
  await setItem(REFRESH_TOKEN_KEY, token);
}

export async function getRefreshToken() {
  try {
    return await getItem(REFRESH_TOKEN_KEY);
  } catch (error) {
    console.error('Failed to get the refresh token from secure store', error);
    return null;
  }
}

export async function saveActiveWorkspaceId(workspaceId: string | null) {
  if (!workspaceId) {
    await deleteItem(WORKSPACE_KEY);
    return;
  }
  await setItem(WORKSPACE_KEY, workspaceId);
}

export async function getActiveWorkspaceId() {
  try {
    return await getItem(WORKSPACE_KEY);
  } catch (error) {
    console.error('Failed to get active workspace', error);
    return null;
  }
}

export async function saveTenantId(tenantId: string | null) {
  if (!tenantId) {
    await deleteItem(TENANT_KEY);
    return;
  }
  await setItem(TENANT_KEY, tenantId);
}

export async function getTenantId() {
  try {
    return await getItem(TENANT_KEY);
  } catch (error) {
    console.error('Failed to get tenant id', error);
    return null;
  }
}

export async function clearSession() {
  await Promise.all([
    deleteToken(),
    saveRefreshToken(null),
    saveActiveWorkspaceId(null),
    saveTenantId(null),
  ]);
}
