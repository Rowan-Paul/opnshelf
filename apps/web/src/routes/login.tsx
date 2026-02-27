import {
	authControllerMeOptions,
	getLoginUrl,
	getSignupUrl,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { useTheme } from "@/components/theme-provider";
import { LoadingButton } from "@/components/ui/loading-button";
import { M3TextField } from "@/components/ui/m3-text-field";
import { env } from "@/env";

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
	const [suggestions, setSuggestions] = useState<
		Array<{
			did: string;
			handle: string;
			displayName: string | null;
			avatar: string | null;
		}>
	>([]);
	const [showSuggestions, setShowSuggestions] = useState(false);
	const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
	const navigate = useNavigate();
	const { error, redirect, reason } = Route.useSearch();
	const handleId = useId();
	const inputAreaRef = useRef<HTMLDivElement>(null);
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const shownErrorRef = useRef<string | null>(null);
	const { seedColor } = useTheme();

	const { data: user, isLoading: isAuthLoading } = useQuery({
		...authControllerMeOptions(),
		staleTime: 5 * 60 * 1000,
		retry: false,
	});

	useEffect(() => {
		if (user && !isAuthLoading) {
			navigate({ to: redirect || "/shelf" });
		}
	}, [user, isAuthLoading, navigate, redirect]);

	useEffect(() => {
		const fetchSuggestions = async () => {
			if (handle.trim().length < 2) {
				setSuggestions([]);
				return;
			}

			setIsLoadingSuggestions(true);
			try {
				const response = await fetch(
					`${env.VITE_API_URL}/auth/suggestions?q=${encodeURIComponent(handle.trim())}`,
				);
				if (response.ok) {
					const data = (await response.json()) as Array<{
						did: string;
						handle: string;
						displayName: string | null;
						avatar: string | null;
					}>;
					setSuggestions(data);
				}
			} catch {
				setSuggestions([]);
			} finally {
				setIsLoadingSuggestions(false);
			}
		};

		if (debounceRef.current) {
			clearTimeout(debounceRef.current);
		}

		debounceRef.current = setTimeout(fetchSuggestions, 300);

		return () => {
			if (debounceRef.current) {
				clearTimeout(debounceRef.current);
			}
		};
	}, [handle]);

	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (
				inputAreaRef.current &&
				!inputAreaRef.current.contains(e.target as Node)
			) {
				setShowSuggestions(false);
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

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

	const shouldShowSuggestions = showSuggestions && handle.trim().length >= 2;

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
						<h1 className="md-headline-large mb-3">Login</h1>
						<p className="md-body-large text-(--md-sys-color-on-surface-variant)">
							Connect with your Atmosphere account
						</p>
					</div>

					{reason === "session_expired" && (
						<div
							className="mb-6 p-4 rounded-lg border"
							style={{
								backgroundColor:
									"rgba(var(--md-sys-color-tertiary-container), 0.5)",
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
						<div ref={inputAreaRef} className="relative">
							<label
								htmlFor={handleId}
								className="mb-2 block md-label-large tracking-[0.08em] uppercase text-(--md-sys-color-on-surface-variant)"
							>
								Handle
							</label>
							<M3TextField
								id={handleId}
								value={handle}
								onChange={(e) => {
									setHandle(e.target.value);
									setShowSuggestions(true);
								}}
								onFocus={() => setShowSuggestions(true)}
								onKeyDown={(e) => {
									if (e.key === "Escape") {
										setShowSuggestions(false);
									}
								}}
								placeholder="username.bsky.social"
								disabled={isSubmitting}
								variant="outlined"
							/>
							{shouldShowSuggestions && suggestions.length > 0 && (
								<div
									className="absolute z-10 w-full mt-1 overflow-y-auto max-h-60 md-elevation-2 rounded-(--md-sys-shape-corner-small)"
									style={{
										backgroundColor: "var(--md-sys-color-surface-container)",
										border: "1px solid var(--md-sys-color-outline-variant)",
									}}
								>
									{suggestions.map((actor) => (
										<button
											key={actor.did}
											type="button"
											onClick={() => {
												setHandle(actor.handle);
												setShowSuggestions(false);
												setSuggestions([]);
												performLogin(actor.handle);
											}}
											className="w-full px-4 py-3 flex items-center gap-3 text-left transition-colors hover:bg-(--md-sys-color-surface-container-high)"
										>
											{actor.avatar ? (
												<img
													src={actor.avatar}
													alt=""
													className="w-8 h-8 rounded-full object-cover"
												/>
											) : (
												<div
													className="w-8 h-8 rounded-full flex items-center justify-center"
													style={{
														backgroundColor:
															"var(--md-sys-color-surface-container-highest)",
														color: "var(--md-sys-color-on-surface)",
													}}
												>
													<span className="text-sm">
														{actor.handle[0]?.toUpperCase()}
													</span>
												</div>
											)}
											<div className="flex-1 min-w-0">
												<div
													className="font-medium truncate md-body-large"
													style={{ color: "var(--md-sys-color-on-surface)" }}
												>
													{actor.displayName || actor.handle}
												</div>
												<div
													className="text-sm truncate md-body-medium"
													style={{
														color: "var(--md-sys-color-on-surface-variant)",
													}}
												>
													{actor.handle}
												</div>
											</div>
										</button>
									))}
								</div>
							)}
							{shouldShowSuggestions && isLoadingSuggestions && (
								<div
									className="absolute z-10 w-full mt-1 p-4 md-elevation-2 rounded-(--md-sys-shape-corner-small)"
									style={{
										backgroundColor: "var(--md-sys-color-surface-container)",
										border: "1px solid var(--md-sys-color-outline-variant)",
									}}
								>
									<div
										className="flex items-center justify-center gap-2"
										style={{ color: "var(--md-sys-color-on-surface-variant)" }}
									>
										<div
											className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
											style={{ borderColor: "var(--md-sys-color-outline)" }}
										/>
										<span className="md-body-medium">Searching...</span>
									</div>
								</div>
							)}
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

						<LoadingButton
							type="submit"
							disabled={isSubmitting}
							isLoading={isSubmitting}
							className="w-full flex items-center justify-center px-4 py-3 font-semibold rounded-(--md-sys-shape-corner-large) transition-colors"
							style={{
								backgroundColor: "var(--md-sys-color-primary)",
								color: "var(--md-sys-color-on-primary)",
							}}
						>
							Connect
						</LoadingButton>

						<button
							type="button"
							onClick={() => {
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
