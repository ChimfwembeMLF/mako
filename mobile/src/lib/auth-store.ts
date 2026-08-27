import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'mako_session_token';
const REFRESH_TOKEN_KEY = 'mako_refresh_token';
const WORKSPACE_KEY = 'mako_active_workspace';
const TENANT_KEY = 'mako_active_tenant';

export async function saveToken(token: string) {
  try {
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
  } catch (error) {
    console.error('Failed to save the token to secure store', error);
  }
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
  try {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  } catch (error) {
    console.error('Failed to delete the token from secure store', error);
  }
}

export async function saveRefreshToken(token: string | null) {
  try {
    if (!token) {
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
      return;
    }
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
  } catch (error) {
    console.error('Failed to save the refresh token to secure store', error);
  }
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
  try {
    if (!workspaceId) {
      await SecureStore.deleteItemAsync(WORKSPACE_KEY);
      return;
    }
    await SecureStore.setItemAsync(WORKSPACE_KEY, workspaceId);
  } catch (error) {
    console.error('Failed to save active workspace', error);
  }
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
  try {
    if (!tenantId) {
      await SecureStore.deleteItemAsync(TENANT_KEY);
      return;
    }
    await SecureStore.setItemAsync(TENANT_KEY, tenantId);
  } catch (error) {
    console.error('Failed to save tenant id', error);
  }
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
