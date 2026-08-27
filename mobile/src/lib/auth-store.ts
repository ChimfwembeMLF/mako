import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'mako_session_token';
const REFRESH_TOKEN_KEY = 'mako_refresh_token';
const WORKSPACE_KEY = 'mako_active_workspace';
const TENANT_KEY = 'mako_active_tenant';

async function setItem(key: string, value: string) {
  await SecureStore.setItemAsync(key, value);
}

async function deleteItem(key: string) {
  try {
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
    return await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
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
    return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
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
    return await SecureStore.getItemAsync(WORKSPACE_KEY);
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
    return await SecureStore.getItemAsync(TENANT_KEY);
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
