/**
 * Mobile app env. Use EXPO_PUBLIC_API_URL to point at the backend.
 */
const EXPO_PUBLIC_API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://127.0.0.1:3001';

export const env = {
  EXPO_PUBLIC_API_URL,
} as const;
