export type RootStackParamList = {
  Home: undefined;
  Search: { q?: string };
  Shelf: undefined;
  Login: { error?: 'auth_failed' | 'callback_failed'; redirect?: string; reason?: 'session_expired' };
  AuthComplete: { session?: string };
  MovieDetail: { movieId: string; title: string };
};
