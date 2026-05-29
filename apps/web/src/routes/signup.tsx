import {
	authControllerMeOptions,
	authControllerRegisterMutation,
} from "@opnshelf/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Film, HelpCircle, Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import LoadingState from "#/components/LoadingState";
import { TurnstileWidget } from "#/components/TurnstileWidget";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "#/components/ui/tooltip";
import { env } from "#/env";
import { useAuth } from "#/lib/auth-context";

export const Route = createFileRoute("/signup")({
	component: SignupPage,
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

function SignupPage() {
	const [username, setUsername] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [captchaToken, setCaptchaToken] = useState<string | null>(null);
	const { isAuthenticated, isLoading: authLoading } = useAuth();
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const handleDomain = env.VITE_PDS_HANDLE_DOMAIN;
	const siteKey = env.VITE_TURNSTILE_SITE_KEY;
	// When no site key is set the widget passes an empty token immediately.
	const captchaReady = !siteKey || captchaToken !== null;

	const onVerify = useCallback((token: string) => setCaptchaToken(token), []);
	const onExpire = useCallback(() => setCaptchaToken(null), []);

	const registerMutation = useMutation({
		mutationKey: ["auth", "register"],
		...authControllerRegisterMutation(),
		onSuccess: async (data) => {
			// Cookie is set; refresh the cached user so the app sees us as logged in.
			await queryClient.invalidateQueries({
				queryKey: authControllerMeOptions().queryKey,
			});
			toast.success(`Welcome — your account ${data.handle} is ready!`);
			navigate({ to: "/dashboard" });
		},
		onError: (error) => {
			toast.error(extractRegisterErrorMessage(error));
			setCaptchaToken(null);
		},
	});
	const isSubmitting = registerMutation.isPending;

	useEffect(() => {
		if (isAuthenticated) {
			navigate({ to: "/dashboard" });
		}
	}, [isAuthenticated, navigate]);

	if (authLoading || isAuthenticated) {
		return <LoadingState />;
	}

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		const trimmedUsername = username.trim().toLowerCase();
		if (!trimmedUsername || !email.trim() || !password) return;
		if (!captchaReady || captchaToken === null) {
			toast.error("Please complete the captcha first.");
			return;
		}

		const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
		registerMutation.mutate({
			body: {
				username: trimmedUsername,
				email: email.trim(),
				password,
				captchaToken,
				timezone,
			},
		});
	};

	return (
		<div className="container-app flex min-h-[calc(100vh-4rem)] items-center justify-center py-12">
			<div className="w-full max-w-md">
				<div className="mb-8 text-center">
					<div className="mb-4 flex justify-center">
						<div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-(--accent) text-[#3f2e00]">
							<Film className="size-8" />
						</div>
					</div>
					<h1 className="text-display-2">Create your OpnShelf account</h1>
					<p className="mt-2 text-(--foreground-muted)">
						Your account lives on OpnShelf's AT Protocol server
					</p>
				</div>

				<div className="card p-6">
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

						<div>
							<label
								htmlFor="email"
								className="mb-1.5 flex items-center gap-1.5 font-medium text-sm"
							>
								Email
								<Tooltip>
									<TooltipTrigger asChild>
										<button
											type="button"
											aria-label="Why we need your email"
											className="cursor-help text-(--foreground-muted) hover:text-(--foreground)"
										>
											<HelpCircle className="size-3.5" />
										</button>
									</TooltipTrigger>
									<TooltipContent className="max-w-64">
										Your account is created on OpnShelf's AT Protocol server,
										which requires an email for account recovery and
										verification. OpnShelf itself never stores it.
									</TooltipContent>
								</Tooltip>
							</label>
							<input
								id="email"
								type="email"
								placeholder="you@example.com"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								className="input"
								autoComplete="email"
								disabled={isSubmitting}
							/>
						</div>

						<div>
							<label
								htmlFor="password"
								className="mb-1.5 block font-medium text-sm"
							>
								Password
							</label>
							<input
								id="password"
								type="password"
								placeholder="At least 8 characters"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								className="input"
								autoComplete="new-password"
								disabled={isSubmitting}
							/>
						</div>

						<TurnstileWidget
							siteKey={siteKey}
							onVerify={onVerify}
							onExpire={onExpire}
						/>

						<button
							type="submit"
							disabled={
								isSubmitting ||
								!username.trim() ||
								!email.trim() ||
								password.length < 8 ||
								!captchaReady
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

					<div className="mt-6 text-center text-(--foreground-muted) text-sm">
						<p>
							Already have an account?{" "}
							<Link to="/login" className="text-(--accent) hover:underline">
								Sign in
							</Link>
						</p>
					</div>
				</div>
			</div>
		</div>
	);
}
