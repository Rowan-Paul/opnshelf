import {
	createFileRoute,
	Link,
	useNavigate,
	useSearch,
} from "@tanstack/react-router";
import { ArrowRight, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import LoadingState from "#/components/LoadingState";
import Logo from "#/components/Logo";
import { env } from "#/env";
import { useAuth } from "#/lib/auth-context";

export const Route = createFileRoute("/login")({
	head: () => ({
		meta: [{ title: "Log in | Opnshelf" }],
	}),
	component: LoginPage,
});

function LoginPage() {
	const [handle, setHandle] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [isSignupLoading, setIsSignupLoading] = useState(false);
	const { login, isAuthenticated, isLoading: authLoading } = useAuth();
	const navigate = useNavigate();
	const search = useSearch({ from: "/login" });
	const message = (search as { message?: string }).message;
	const error = (search as { error?: string }).error;

	// Redirect if already authenticated
	useEffect(() => {
		if (isAuthenticated) {
			navigate({ to: "/" });
		}
	}, [isAuthenticated, navigate]);

	// Surface OAuth failures the backend redirects back with, then strip the
	// param so a refresh doesn't re-toast.
	useEffect(() => {
		if (!error) return;
		const messages: Record<string, string> = {
			handle_required: "Please enter your handle to sign in.",
			auth_failed: "Sign-in failed. Check your handle and try again.",
			callback_failed: "We couldn't complete sign-in. Please try again.",
		};
		toast.error(messages[error] ?? "Sign-in failed. Please try again.");
		void navigate({ to: "/login", replace: true });
	}, [error, navigate]);

	// Show loading while auth state is resolving (or when already
	// authenticated but the redirect hasn't fired yet) to prevent
	// login form from flashing for logged-in users
	if (authLoading || isAuthenticated) {
		return <LoadingState />;
	}

	const handleLogin = async (e: React.FormEvent) => {
		e.preventDefault();
		const trimmed = handle.trim();
		if (!trimmed) return;
		setIsLoading(true);
		try {
			const res = await fetch(
				`https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(trimmed)}`,
			);
			if (!res.ok) {
				toast.error("Handle not found. Check your handle and try again.");
				setIsLoading(false);
				return;
			}
		} catch {
			// Network error — let the backend handle it
		}
		login(trimmed);
	};

	const handleSignup = () => {
		setIsSignupLoading(true);
		navigate({ to: "/signup" });
	};

	return (
		<div className="container-app flex min-h-[calc(100vh-4rem)] items-center justify-center py-12">
			<div className="w-full max-w-md">
				{/* Logo */}
				<div className="mb-8 text-center">
					<div className="mb-4 flex justify-center">
						<Logo className="size-16 rounded-2xl" />
					</div>
					<h1 className="text-display-2">Welcome to Opnshelf</h1>
					<p className="mt-2 text-(--foreground-muted)">
						Track what you watch with your AT Protocol account
					</p>
				</div>

				{/* Redirect Notice */}
				{message && (
					<div className="mb-6 rounded-lg border border-(--accent) bg-(--accent-subtle) px-4 py-3 text-(--foreground) text-sm">
						{message}
					</div>
				)}

				{/* Login Form */}
				<div className="card p-6">
					<form onSubmit={handleLogin} className="space-y-4">
						<div>
							<label
								htmlFor="handle"
								className="mb-1.5 block font-medium text-sm"
							>
								Your Handle
							</label>
							<input
								id="handle"
								type="text"
								placeholder="username.bsky.social"
								value={handle}
								onChange={(e) => setHandle(e.target.value)}
								className="input"
								disabled={isLoading}
							/>
							<p className="mt-1 text-(--foreground-muted) text-xs">
								Enter your Bluesky or AT Protocol handle
							</p>
						</div>

						<button
							type="submit"
							disabled={isLoading || isSignupLoading || !handle.trim()}
							className="btn btn-primary w-full"
						>
							{isLoading ? (
								<>
									<Loader2 className="size-4 animate-spin" />
									Connecting...
								</>
							) : (
								<>
									Sign In
									<ArrowRight className="size-4" />
								</>
							)}
						</button>
					</form>

					<div className="my-6 flex items-center gap-4">
						<div className="h-px flex-1 bg-(--border)" />
						<span className="text-(--foreground-muted) text-xs">or</span>
						<div className="h-px flex-1 bg-(--border)" />
					</div>

					<button
						type="button"
						onClick={handleSignup}
						disabled={isLoading || isSignupLoading}
						className="btn btn-secondary w-full"
					>
						{isSignupLoading ? (
							<>
								<Loader2 className="size-4 animate-spin" />
								Connecting...
							</>
						) : (
							"Create New Account"
						)}
					</button>

					{/* For anyone who signed up with Google and never learned their
					    handle. The PDS sign-in page has the Google button. */}
					<p className="mt-4 text-center text-(--foreground-muted) text-sm">
						Signed up with Google?{" "}
						<a
							href={`${env.VITE_API_URL}/auth/login/pds`}
							className="text-(--accent) hover:underline"
						>
							Sign in without your handle
						</a>
					</p>
				</div>

				{/* Info */}
				<div className="mt-6 text-center text-(--foreground-muted) text-sm">
					<p>
						By signing in, you agree to our{" "}
						<Link to="/tos" className="text-(--accent) hover:underline">
							Terms of Service
						</Link>{" "}
						and{" "}
						<Link to="/privacy" className="text-(--accent) hover:underline">
							Privacy Policy
						</Link>
						.
					</p>
					<p className="mt-4">
						Powered by{" "}
						<a
							href="https://atproto.com"
							target="_blank"
							rel="noopener noreferrer"
							className="text-(--accent) hover:underline"
						>
							AT Protocol
						</a>
					</p>
				</div>
			</div>
		</div>
	);
}
