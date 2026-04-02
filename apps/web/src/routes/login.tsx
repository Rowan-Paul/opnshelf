import {
	authControllerMeOptions,
	getLoginUrl,
	getSignupUrl,
} from "@opnshelf/api";
import { usePostHog } from "@posthog/react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { useTheme } from "@/components/theme-provider";
import { M3Button } from "@/components/ui/m3-button";
import { M3TextField } from "@/components/ui/m3-text-field";

const OAUTH_PENDING_KEY = "oauth_pending";

const loginSearchSchema = z.object({
	error: z.enum(["auth_failed", "callback_failed"]).optional(),
	redirect: z.string().optional(),
	reason: z.enum(["session_expired"]).optional(),
});

export const Route = createFileRoute("/login")({
	validateSearch: loginSearchSchema,
	head: () => ({
		meta: [{ title: "Sign In | OpnShelf" }],
	}),
	component: LoginPage,
});

function LoginPage() {
	const [handle, setHandle] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isAboutExpanded, setIsAboutExpanded] = useState(false);
	const navigate = useNavigate();
	const { error, redirect, reason } = Route.useSearch();
	const handleId = useId();
	const shownErrorRef = useRef<string | null>(null);
	const { seedColor } = useTheme();
	const posthog = usePostHog();

	const { data: user, isLoading: isAuthLoading } = useQuery({
		...authControllerMeOptions(),
		staleTime: 5 * 60 * 1000,
		retry: false,
	});

	useEffect(() => {
		if (user && !isAuthLoading) {
			if (redirect) {
				navigate({ to: redirect });
				return;
			}

			navigate({ to: "/" });
		}
	}, [user, isAuthLoading, navigate, redirect]);

	const detectUserTimezone = (): string => {
		try {
			return Intl.DateTimeFormat().resolvedOptions().timeZone;
		} catch {
			return "";
		}
	};

	const performLogin = (loginHandle: string) => {
		setIsSubmitting(true);
		sessionStorage.setItem(OAUTH_PENDING_KEY, "1");

		if (redirect) {
			sessionStorage.setItem("auth_redirect", redirect);
		}

		posthog.capture("login_initiated", {
			handle: loginHandle || undefined,
			has_redirect: !!redirect,
		});

		const timezone = detectUserTimezone();
		const loginUrl = getLoginUrl(
			loginHandle || undefined,
			timezone || undefined,
		);
		window.location.href = loginUrl;
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		performLogin(handle);
	};

	const errorMessages: Record<string, string> = {
		auth_failed: "Authentication failed. Please try again.",
		callback_failed: "Something went wrong during sign in. Please try again.",
		handle_required: "Please enter your handle (e.g., username.bsky.social).",
	};

	useEffect(() => {
		if (!error) {
			shownErrorRef.current = null;

			const hadPendingOAuth = sessionStorage.getItem(OAUTH_PENDING_KEY) === "1";
			if (hadPendingOAuth) {
				sessionStorage.removeItem(OAUTH_PENDING_KEY);
				toast.error("Sign in failed. Please try again.");
			}
			return;
		}
		if (shownErrorRef.current === error) {
			return;
		}
		shownErrorRef.current = error;
		sessionStorage.removeItem(OAUTH_PENDING_KEY);
		toast.error(errorMessages[error] || "An error occurred. Please try again.");
	}, [error]);

	if (isAuthLoading) {
		return (
			<div
				className="flex-1 flex items-center justify-center min-h-0"
				style={{ backgroundColor: "var(--md-sys-color-background)" }}
			>
				<div
					className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
					style={{ borderColor: seedColor }}
				/>
			</div>
		);
	}

	return (
		<div
			className="flex-1 flex flex-col min-h-0"
			style={{
				backgroundColor: "var(--md-sys-color-background)",
				color: "var(--md-sys-color-on-background)",
			}}
		>
			<div className="flex-1 flex items-center justify-center p-4">
				<div
					className="w-full max-w-2xl rounded-(--md-sys-shape-corner-large) border p-6 md:p-8"
					style={{
						backgroundColor: "var(--md-sys-color-surface)",
						borderColor: "var(--md-sys-color-outline-variant)",
					}}
				>
					<div className="mb-8">
						<h1 className="md-headline-large mb-3">Sign in</h1>
						<p className="md-body-large text-(--md-sys-color-on-surface-variant)">
							Connect with your Atmosphere account
						</p>
					</div>

					{reason === "session_expired" && (
						<div
							className="mb-6 p-4 rounded-lg border"
							style={{
								backgroundColor:
									"color-mix(in srgb, var(--md-sys-color-tertiary-container) 50%, transparent)",
								borderColor: "var(--md-sys-color-tertiary)",
							}}
						>
							<p
								className="md-title-small"
								style={{ color: "var(--md-sys-color-on-tertiary-container)" }}
							>
								You have been logged out
							</p>
							<p
								className="md-body-medium"
								style={{ color: "var(--md-sys-color-on-tertiary-container)" }}
							>
								Your session has expired. Please sign in again to continue.
							</p>
						</div>
					)}

					{error && (
						<div
							className="mb-6 p-4 rounded-lg flex items-start gap-3"
							style={{
								backgroundColor: "var(--md-sys-color-error-container)",
								border: "1px solid var(--md-sys-color-error)",
							}}
						>
							<AlertCircle
								className="w-5 h-5 shrink-0 mt-0.5"
								style={{ color: "var(--md-sys-color-error)" }}
							/>
							<div
								style={{ color: "var(--md-sys-color-on-error-container)" }}
								className="md-body-medium"
							>
								{errorMessages[error] || "An error occurred. Please try again."}
							</div>
						</div>
					)}

					<form onSubmit={handleSubmit} className="space-y-5">
						<div>
							<M3TextField
								id={handleId}
								label="Handle"
								value={handle}
								onChange={(e) => setHandle(e.target.value)}
								placeholder="username.bsky.social"
								disabled={isSubmitting}
								variant="outlined"
							/>
						</div>

						<div
							className="rounded-(--md-sys-shape-corner-medium) border px-3 py-2"
							style={{
								borderColor: "var(--md-sys-color-outline-variant)",
								backgroundColor: "var(--md-sys-color-surface-container-low)",
							}}
						>
							<button
								type="button"
								onClick={() => setIsAboutExpanded((value) => !value)}
								className="w-full flex items-center justify-between gap-2 py-1 text-left"
								aria-expanded={isAboutExpanded}
							>
								<span className="md-body-large text-(--md-sys-color-on-surface)">
									What is an Atmosphere account?
								</span>
								{isAboutExpanded ? (
									<ChevronUp
										size={18}
										className="text-(--md-sys-color-on-surface-variant)"
									/>
								) : (
									<ChevronDown
										size={18}
										className="text-(--md-sys-color-on-surface-variant)"
									/>
								)}
							</button>
							{isAboutExpanded && (
								<p
									className="md-body-medium pt-2"
									style={{ color: "var(--md-sys-color-on-surface-variant)" }}
								>
									Atmosphere uses the AT Protocol so your account is portable.
									You can keep one identity across compatible apps while staying
									in control of your data. For example, you can sign in to
									Bluesky with your OpnShelf account and vice versa.
								</p>
							)}
						</div>

						<M3Button
							type="submit"
							variant="filled"
							isLoading={isSubmitting}
							className="w-full flex items-center justify-center px-4 py-3 font-semibold rounded-(--md-sys-shape-corner-large) transition-colors"
						>
							Connect
						</M3Button>

						<button
							type="button"
							onClick={() => {
								posthog.capture("signup_initiated");
								const timezone = detectUserTimezone();
								window.location.href = getSignupUrl(timezone || undefined);
							}}
							className="w-full px-4 py-3 rounded-(--md-sys-shape-corner-large) border transition-colors md-title-medium"
							style={{
								borderColor: "var(--md-sys-color-outline-variant)",
								color: seedColor,
							}}
						>
							Create a new account
						</button>
					</form>
				</div>
			</div>
		</div>
	);
}
