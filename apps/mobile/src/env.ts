/**
 * Mobile app env. Use EXPO_PUBLIC_API_URL to point at the backend.
 */
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://127.0.0.1:3001';

export const env = {
  API_URL,
} as const;
