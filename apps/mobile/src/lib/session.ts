import * as SecureStore from 'expo-secure-store';
import { setSessionToken } from '@opnshelf/api';

const SESSION_KEY = 'auth_session';

/**
 * Store the session token securely and configure the API client to use it.
 */
export async function saveSession(token: string): Promise<void> {
  await SecureStore.setItemAsync(SESSION_KEY, token);
  setSessionToken(token);
}

/**
 * Load the session token from secure storage and configure the API client.
 * Call this on app startup.
 */
export async function loadSession(): Promise<string | null> {
  const token = await SecureStore.getItemAsync(SESSION_KEY);
  if (token) {
    setSessionToken(token);
  }
  return token;
}

/**
 * Clear the session token from storage and API client.
 * Call this on logout.
 */
export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
  setSessionToken(null);
}

/**
 * Check if a session exists in storage.
 */
export async function hasSession(): Promise<boolean> {
  const token = await SecureStore.getItemAsync(SESSION_KEY);
  return token !== null;
}
