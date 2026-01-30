import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Film, LogIn, AlertCircle } from 'lucide-react';
import { getAuthUser, getLoginUrl } from '@opnshelf/api';
import { z } from 'zod';

const loginSearchSchema = z.object({
  error: z.enum(['auth_failed', 'callback_failed']).optional(),
  redirect: z.string().optional(),
});

export const Route = createFileRoute('/login')({
  validateSearch: loginSearchSchema,
  component: LoginPage,
});

function LoginPage() {
  const [handle, setHandle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const { error, redirect } = Route.useSearch();

  // Check if user is already logged in
  const { data: user, isLoading: isAuthLoading } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: getAuthUser,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  // Redirect if already logged in
  useEffect(() => {
    if (user && !isAuthLoading) {
      navigate({ to: redirect || '/' });
    }
  }, [user, isAuthLoading, navigate, redirect]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Store redirect URL in sessionStorage so we can use it after callback
    if (redirect) {
      sessionStorage.setItem('auth_redirect', redirect);
    }

    // Redirect to backend login with optional handle
    const loginUrl = getLoginUrl(handle || undefined);
    window.location.href = loginUrl;
  };

  const errorMessages: Record<string, string> = {
    auth_failed: 'Authentication failed. Please try again.',
    callback_failed: 'Something went wrong during sign in. Please try again.',
  };

  if (isAuthLoading) {
    return (
      <div className="flex-1 bg-gray-950 flex items-center justify-center min-h-0">
        <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 bg-gray-950 text-gray-50 flex flex-col min-h-0">
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Logo and title */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <Film className="w-12 h-12 text-purple-500" />
            </div>
            <h1 className="text-3xl font-bold mb-2">Sign in to OpnShelf</h1>
            <p className="text-gray-400">
              Use your Bluesky account to sign in
            </p>
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-6 p-4 bg-red-900/30 border border-red-800 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="text-red-200 text-sm">
                {errorMessages[error] || 'An error occurred. Please try again.'}
              </div>
            </div>
          )}

          {/* Login form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="handle"
                className="block text-sm font-medium text-gray-300 mb-2"
              >
                Bluesky Handle
              </label>
              <input
                id="handle"
                type="text"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="username.bsky.social"
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors"
                disabled={isSubmitting}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Redirecting...</span>
                </>
              ) : (
                <>
                  <LogIn size={20} />
                  <span>Sign in with Bluesky</span>
                </>
              )}
            </button>

            <p className="text-center text-sm text-gray-400">
              Don&apos;t have an account?{' '}
              <a
                href="https://bsky.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-400 hover:text-purple-300 underline underline-offset-2 transition-colors"
              >
                Sign up on Bluesky
              </a>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
