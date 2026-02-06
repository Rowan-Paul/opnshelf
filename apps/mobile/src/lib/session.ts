import * as SecureStore from 'expo-secure-store';
import { setSessionToken } from '@opnshelf/api';

const SESSION_KEY = 'auth_session';

/**
 * Store the session token securely and configure the API client to use it.
 */
export async function saveSession(token: string): Promise<void> {
  console.log('[Session] saveSession called with token:', token.substring(0, 20) + '...');
  await SecureStore.setItemAsync(SESSION_KEY, token);
  setSessionToken(token);
  console.log('[Session] Session saved');
}

/**
 * Load the session token from secure storage and configure the API client.
 * Call this on app startup.
 */
export async function loadSession(): Promise<string | null> {
  const token = await SecureStore.getItemAsync(SESSION_KEY);
  console.log('[Session] loadSession called');
  console.log('[Session] Token found:', token ? 'YES' : 'NO');
  if (token) {
    setSessionToken(token);
    console.log('[Session] Token set via setSessionToken()');
  }
  return token;
}

/**
 * Clear the session token from storage and API client.
 * Call this on logout.
 */
export async function clearSession(): Promise<void> {
  console.log('[Session] clearSession called');
  await SecureStore.deleteItemAsync(SESSION_KEY);
  setSessionToken(null);
  console.log('[Session] Session cleared');
}

/**
 * Check if a session exists in storage.
 */
export async function hasSession(): Promise<boolean> {
  const token = await SecureStore.getItemAsync(SESSION_KEY);
  return token !== null;
}
