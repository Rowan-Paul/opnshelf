import { authControllerMeOptions, getLoginUrl } from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertCircle, Film, LogIn } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { z } from "zod";
import { useTheme } from "@/components/theme-provider";
import { LoadingButton } from "@/components/ui/loading-button";
import { M3TextField } from "@/components/ui/m3-text-field";
import { env } from "@/env";

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
	const suggestionsRef = useRef<HTMLDivElement>(null);
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
				suggestionsRef.current &&
				!suggestionsRef.current.contains(e.target as Node)
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
				<div className="w-full max-w-md">
					<div className="text-center mb-8">
						<div className="flex justify-center mb-4">
							<Film className="w-12 h-12" style={{ color: seedColor }} />
						</div>
						<h1 className="md-headline-medium mb-2">Sign in to OpnShelf</h1>
						<p style={{ color: "var(--md-sys-color-on-surface-variant)" }}>
							Use your ATProto account to sign in
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

					<form onSubmit={handleSubmit} className="space-y-6">
						<div className="relative">
							<M3TextField
								id={handleId}
								label="Handle"
								value={handle}
								onChange={(e) => {
									setHandle(e.target.value);
									setShowSuggestions(true);
								}}
								onFocus={() => setShowSuggestions(true)}
								placeholder="username.bsky.social"
								disabled={isSubmitting}
								variant="outlined"
							/>
							{showSuggestions && suggestions.length > 0 && (
								<div
									ref={suggestionsRef}
									className="absolute z-10 w-full mt-1 overflow-y-auto max-h-60 md-elevation-2 rounded-[var(--md-sys-shape-corner-small)]"
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
											className="w-full px-4 py-3 flex items-center gap-3 text-left transition-colors hover:bg-[var(--md-sys-color-surface-container-high)]"
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
							{showSuggestions && isLoadingSuggestions && (
								<div
									ref={suggestionsRef}
									className="absolute z-10 w-full mt-1 p-4 md-elevation-2 rounded-[var(--md-sys-shape-corner-small)]"
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

						<LoadingButton
							type="submit"
							disabled={isSubmitting}
							isLoading={isSubmitting}
							className="w-full flex items-center justify-center gap-2 px-4 py-3 font-semibold rounded-[var(--md-sys-shape-corner-large)] transition-colors"
							style={{
								backgroundColor: "var(--md-sys-color-primary)",
								color: "var(--md-sys-color-on-primary)",
							}}
						>
							<LogIn size={20} />
							Sign in
						</LoadingButton>

						<p
							className="text-center md-body-medium"
							style={{ color: "var(--md-sys-color-on-surface-variant)" }}
						>
							Don&apos;t have an account?{" "}
							<a
								href="https://bsky.app/"
								target="_blank"
								rel="noopener noreferrer"
								className="underline underline-offset-2 transition-colors"
								style={{ color: seedColor }}
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
