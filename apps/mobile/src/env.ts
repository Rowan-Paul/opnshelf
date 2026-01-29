/**
 * Mobile app env. Use EXPO_PUBLIC_API_URL to point at the backend.
 * Defaults to localhost:3001 (override for device: use your machine IP).
 */
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';

export const env = {
  API_URL,
} as const;
