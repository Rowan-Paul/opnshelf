import createClient from 'openapi-fetch';
import type { paths } from './generated/schema';

// Allow configuring base URL
let baseUrl = 'http://127.0.0.1:3001';

function createApiClient() {
  return createClient<paths>({
    baseUrl,
    credentials: 'include',
  });
}

let apiClient = createApiClient();

export function configureApiClient(url: string) {
  baseUrl = url;
  apiClient = createApiClient();
}

export { apiClient };

// Auth types
export interface AuthUser {
  did: string;
  handle: string;
  displayName: string | null;
  avatar: string | null;
}

// Auth functions
export async function getAuthUser(): Promise<AuthUser | null> {
  try {
    const response = await fetch(`${baseUrl}/auth/me`, {
      credentials: 'include',
    });
    
    if (!response.ok) {
      return null;
    }
    
    return response.json();
  } catch {
    return null;
  }
}

export function getLoginUrl(handle?: string): string {
  const params = handle ? `?handle=${encodeURIComponent(handle)}` : '';
  return `${baseUrl}/auth/login${params}`;
}

export async function logout(): Promise<void> {
  await fetch(`${baseUrl}/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  });
}

// Movie functions
export async function searchMovies(query: string) {
  const { data, error } = await apiClient.GET('/movies/search', {
    params: { query: { query } },
  });
  
  if (error) throw new Error('Failed to search movies');
  return data;
}

export async function getMovieDetails(movieId: string) {
  const { data, error } = await apiClient.GET('/movies/tmdb/{movieId}', {
    params: { path: { movieId } },
  });
  
  if (error) throw new Error('Failed to get movie details');
  return data;
}

export async function getUserMovies(userDid: string) {
  const { data, error } = await apiClient.GET('/movies/user/{userDid}', {
    params: { path: { userDid } },
  });
  
  if (error) throw new Error('Failed to get user movies');
  return data;
}