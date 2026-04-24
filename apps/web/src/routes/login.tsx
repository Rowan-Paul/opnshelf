import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Film, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "#/lib/auth-context";

export const Route = createFileRoute("/login")({
	component: LoginPage,
});

function LoginPage() {
	const [handle, setHandle] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const { login, signup, isAuthenticated } = useAuth();
	const navigate = useNavigate();

	// Redirect if already authenticated
	useEffect(() => {
		if (isAuthenticated) {
			navigate({ to: "/dashboard" });
		}
	}, [isAuthenticated, navigate]);

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
						<div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-(--accent) text-[#3f2e00]">
							<Film className="h-8 w-8" />
						</div>
					</div>
					<h1 className="text-display-2">Welcome to OpnShelf</h1>
					<p className="mt-2 text-(--foreground-muted)">
						Track what you watch with your AT Protocol account
					</p>
				</div>

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
						<div className="h-px flex-1 bg-(--border)" />
						<span className="text-(--foreground-muted) text-xs">or</span>
						<div className="h-px flex-1 bg-(--border)" />
					</div>

					<button
						type="button"
						onClick={handleSignup}
						disabled={isLoading}
						className="btn btn-secondary w-full"
					>
						Create New Account
					</button>
				</div>

				{/* Info */}
				<div className="mt-6 text-center text-(--foreground-muted) text-sm">
					<p>
						By signing in, you agree to our{" "}
						<span className="text-(--accent)">Terms of Service</span> and{" "}
						<span className="text-(--accent)">Privacy Policy</span>.
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
