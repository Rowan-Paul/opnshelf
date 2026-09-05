import { authControllerGoogleRegisterMutation } from "@opnshelf/api";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { GoogleMark } from "#/components/GoogleMark";
import LoadingState from "#/components/LoadingState";
import Logo from "#/components/Logo";
import { TurnstileWidget } from "#/components/TurnstileWidget";
import { env } from "#/env";
import { posthog } from "#/integrations/posthog/provider";
import { useAuth } from "#/lib/auth-context";

export const Route = createFileRoute("/signup_/google")({
	head: () => ({
		meta: [{ title: "Choose your handle | Opnshelf" }],
	}),
	validateSearch: z.object({
		suggested: z.string().optional(),
	}),
	component: GoogleSignupPage,
});

/** Pull a human-readable message out of a NestJS error body (string or string[]). */
function extractRegisterErrorMessage(error: unknown): string {
	const fallback = "Signup failed. Please try again.";
	if (error && typeof error === "object" && "message" in error) {
		const message = (error as { message?: unknown }).message;
		if (Array.isArray(message)) return message.join(", ");
		if (typeof message === "string" && message.length > 0) return message;
	}
	return fallback;
}

function GoogleSignupPage() {
	const { suggested } = Route.useSearch();
	const [email, setEmail] = useState<string | null>(null);
	const [pendingLoaded, setPendingLoaded] = useState(false);
	const [username, setUsername] = useState(suggested ?? "");
	const [captchaToken, setCaptchaToken] = useState<string | null>(null);
	const { isAuthenticated, isLoading: authLoading } = useAuth();
	const navigate = useNavigate();

	const handleDomain = env.VITE_PDS_HANDLE_DOMAIN;
	const siteKey = env.VITE_TURNSTILE_SITE_KEY;
	const captchaReady = !siteKey || captchaToken !== null;

	const onVerify = useCallback((token: string) => setCaptchaToken(token), []);
	const onExpire = useCallback(() => setCaptchaToken(null), []);

	const registerMutation = useMutation({
		mutationKey: ["auth", "google-register"],
		...authControllerGoogleRegisterMutation(),
		onSuccess: (data) => {
			posthog.capture("user_signed_up", { method: "google" });
			// Straight into the PDS authorization page. It grants opnshelf its
			// scopes and its callback seeds the profile and default lists, so this
			// has to be a full navigation, not a router push.
			window.location.href = data.coreOAuthUrl;
		},
		onError: (error) => {
			toast.error(extractRegisterErrorMessage(error));
			setCaptchaToken(null);
		},
	});
	// Stay disabled through the whole submit lifecycle, including the gap between
	// success and the browser leaving the page.
	const isSubmitting = registerMutation.isPending || registerMutation.isSuccess;

	useEffect(() => {
		if (isAuthenticated) {
			navigate({ to: "/" });
		}
	}, [isAuthenticated, navigate]);

	useEffect(() => {
		fetch(`${env.VITE_API_URL}/auth/google/pending`, {
			credentials: "include",
		})
			.then(async (response) => {
				if (!response.ok) return;
				const data = (await response.json()) as { email?: unknown };
				if (typeof data.email === "string") setEmail(data.email);
			})
			.finally(() => setPendingLoaded(true));
	}, []);

	if (authLoading || isAuthenticated || !pendingLoaded) {
		return <LoadingState />;
	}

	// No pending Google signup to finish (a bookmarked or reloaded URL).
	if (!email) {
		return (
			<div className="container-app flex min-h-[calc(100vh-4rem)] items-center justify-center py-12">
				<div className="w-full max-w-md text-center">
					<h1 className="text-display-2">Start again</h1>
					<p className="mt-2 text-(--foreground-muted)">
						This page only works right after signing in with Google.
					</p>
					<Link to="/signup" className="btn btn-primary mt-6">
						Back to sign up
					</Link>
				</div>
			</div>
		);
	}

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (isSubmitting) return;
		const trimmedUsername = username.trim().toLowerCase();
		if (!trimmedUsername) return;
		if (!captchaReady || captchaToken === null) {
			toast.error("Please complete the captcha first.");
			return;
		}

		registerMutation.mutate({
			body: {
				username: trimmedUsername,
				captchaToken,
				timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
			},
		});
	};

	return (
		<div className="container-app flex min-h-[calc(100vh-4rem)] items-center justify-center py-12">
			<div className="w-full max-w-md">
				<div className="mb-8 text-center">
					<div className="mb-4 flex justify-center">
						<Logo className="size-16 rounded-2xl" />
					</div>
					<h1 className="text-display-2">Pick your handle</h1>
					<p className="mt-2 text-(--foreground-muted)">
						One more step and your Opnshelf account is ready
					</p>
				</div>

				<div className="card p-6">
					<div className="mb-4 flex items-center gap-2 rounded-lg border border-(--border) px-3 py-2 text-sm">
						<GoogleMark className="size-4 shrink-0" />
						<span className="truncate text-(--foreground-muted)">{email}</span>
					</div>

					<form onSubmit={handleSubmit} className="space-y-4">
						<div>
							<label
								htmlFor="username"
								className="mb-1.5 block font-medium text-sm"
							>
								Username
							</label>
							<div className="flex items-center gap-2">
								<input
									id="username"
									type="text"
									placeholder="yourname"
									value={username}
									onChange={(e) => setUsername(e.target.value)}
									className="input"
									autoComplete="username"
									disabled={isSubmitting}
								/>
								<span className="whitespace-nowrap text-(--foreground-muted) text-sm">
									.{handleDomain}
								</span>
							</div>
							<p className="mt-1 text-(--foreground-muted) text-xs">
								This becomes your handle:{" "}
								{username.trim()
									? `${username.trim().toLowerCase()}.${handleDomain}`
									: `yourname.${handleDomain}`}
							</p>
						</div>

						<TurnstileWidget
							siteKey={siteKey}
							onVerify={onVerify}
							onExpire={onExpire}
						/>

						<button
							type="submit"
							disabled={
								isSubmitting || username.trim().length < 3 || !captchaReady
							}
							className="btn btn-primary w-full"
						>
							{isSubmitting ? (
								<>
									<Loader2 className="size-4 animate-spin" />
									Creating account...
								</>
							) : (
								<>
									Create Account
									<ArrowRight className="size-4" />
								</>
							)}
						</button>
					</form>

					<p className="mt-6 text-center text-(--foreground-muted) text-sm">
						Wrong Google account?{" "}
						<Link to="/signup" className="text-(--accent) hover:underline">
							Start again
						</Link>
					</p>
				</div>
			</div>
		</div>
	);
}
