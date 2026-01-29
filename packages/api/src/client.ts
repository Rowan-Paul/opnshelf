import createClient from 'openapi-fetch';
import type { paths } from './generated/schema';

// Allow configuring base URL
let baseUrl = 'http://localhost:3001';

export function configureApiClient(url: string) {
  baseUrl = url;
}

export const apiClient = createClient<paths>({
  get baseUrl() {
    return baseUrl;
  },
});

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