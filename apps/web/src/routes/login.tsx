import { createFileRoute, redirect } from "@tanstack/react-router";
import { ArrowRight, Film, Loader2 } from "lucide-react";
import { useState } from "react";
import { useAuth } from "#/lib/auth-context";

export const Route = createFileRoute("/login")({
	component: LoginPage,
	beforeLoad: () => {
		// If user is already authenticated, redirect to home
		// Note: This is a simple check, the actual check happens in the component
	},
});

function LoginPage() {
	const [handle, setHandle] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const { login, signup, isAuthenticated } = useAuth();

	// Redirect if already authenticated
	if (isAuthenticated) {
		throw redirect({ to: "/" });
	}

	const handleLogin = (e: React.FormEvent) => {
		e.preventDefault();
		if (!handle.trim()) return;
		setIsLoading(true);
		login(handle.trim());
	};

	const handleSignup = () => {
		setIsLoading(true);
		signup();
	};

	return (
		<div className="container-app flex min-h-[calc(100vh-4rem)] items-center justify-center py-12">
			<div className="w-full max-w-md">
				{/* Logo */}
				<div className="mb-8 text-center">
					<div className="mb-4 flex justify-center">
						<div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--accent)] text-white">
							<Film className="h-8 w-8" />
						</div>
					</div>
					<h1 className="text-display-2">Welcome to OpnShelf</h1>
					<p className="mt-2 text-[var(--foreground-muted)]">
						Track what you watch with your AT Protocol account
					</p>
				</div>

				{/* Login Form */}
				<div className="card p-6">
					<form onSubmit={handleLogin} className="space-y-4">
						<div>
							<label
								htmlFor="handle"
								className="mb-1.5 block text-sm font-medium"
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
							<p className="mt-1 text-xs text-[var(--foreground-muted)]">
								Enter your Bluesky or AT Protocol handle
							</p>
						</div>

						<button
							type="submit"
							disabled={isLoading || !handle.trim()}
							className="btn btn-primary w-full"
						>
							{isLoading ? (
								<>
									<Loader2 className="h-4 w-4 animate-spin" />
									Connecting...
								</>
							) : (
								<>
									Sign In
									<ArrowRight className="h-4 w-4" />
								</>
							)}
						</button>
					</form>

					<div className="my-6 flex items-center gap-4">
						<div className="h-px flex-1 bg-[var(--border)]" />
						<span className="text-xs text-[var(--foreground-muted)]">or</span>
						<div className="h-px flex-1 bg-[var(--border)]" />
					</div>

					<button
						type="button"
						onClick={handleSignup}
						disabled={isLoading}
						className="btn btn-secondary w-full"
					>
						{isLoading ? (
							<>
								<Loader2 className="h-4 w-4 animate-spin" />
								Redirecting...
							</>
						) : (
							"Create New Account"
						)}
					</button>
				</div>

				{/* Info */}
				<div className="mt-6 text-center text-sm text-[var(--foreground-muted)]">
					<p>
						By signing in, you agree to our{" "}
						<span className="text-[var(--accent)]">Terms of Service</span> and{" "}
						<span className="text-[var(--accent)]">Privacy Policy</span>.
					</p>
					<p className="mt-4">
						Powered by{" "}
						<a
							href="https://atproto.com"
							target="_blank"
							rel="noopener noreferrer"
							className="text-[var(--accent)] hover:underline"
						>
							AT Protocol
						</a>
					</p>
				</div>
			</div>
		</div>
	);
}
