import { authControllerMeOptions, getLoginUrl } from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertCircle, Film, LogIn } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { z } from "zod";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { LoadingButton } from "@/components/ui/loading-button";
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
			<div className="flex-1 bg-gray-950 flex items-center justify-center min-h-0">
				<div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
			</div>
		);
	}

	return (
		<div className="flex-1 bg-gray-950 text-gray-50 flex flex-col min-h-0">
			<div className="flex-1 flex items-center justify-center p-4">
				<div className="w-full max-w-md">
					<div className="text-center mb-8">
						<div className="flex justify-center mb-4">
							<Film className="w-12 h-12 text-purple-500" />
						</div>
						<h1 className="text-3xl font-bold mb-2">Sign in to OpnShelf</h1>
						<p className="text-gray-400">Use your ATProto account to sign in</p>
					</div>

					{reason === "session_expired" && (
						<Alert className="mb-6 border-amber-800 bg-amber-950/50 text-amber-200 [&>svg]:text-amber-500">
							<AlertTitle>You have been logged out</AlertTitle>
							<AlertDescription>
								Your session has expired. Please sign in again to continue.
							</AlertDescription>
						</Alert>
					)}

					{error && (
						<div className="mb-6 p-4 bg-red-900/30 border border-red-800 rounded-lg flex items-start gap-3">
							<AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
							<div className="text-red-200 text-sm">
								{errorMessages[error] || "An error occurred. Please try again."}
							</div>
						</div>
					)}

					<form onSubmit={handleSubmit} className="space-y-6">
						<div className="relative">
							<label
								htmlFor={handleId}
								className="block text-sm font-medium text-gray-300 mb-2"
							>
								Handle
							</label>
							<input
								id={handleId}
								type="text"
								value={handle}
								onChange={(e) => {
									setHandle(e.target.value);
									setShowSuggestions(true);
								}}
								onFocus={() => setShowSuggestions(true)}
								placeholder="username.bsky.social"
								className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors"
								disabled={isSubmitting}
								autoComplete="off"
							/>
							{showSuggestions && suggestions.length > 0 && (
								<div
									ref={suggestionsRef}
									className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg overflow-y-auto max-h-60"
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
											className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-700 transition-colors text-left"
										>
											{actor.avatar ? (
												<img
													src={actor.avatar}
													alt=""
													className="w-8 h-8 rounded-full object-cover"
												/>
											) : (
												<div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center">
													<span className="text-sm text-gray-300">
														{actor.handle[0]?.toUpperCase()}
													</span>
												</div>
											)}
											<div className="flex-1 min-w-0">
												<div className="text-white font-medium truncate">
													{actor.displayName || actor.handle}
												</div>
												<div className="text-gray-400 text-sm truncate">
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
									className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg p-4"
								>
									<div className="flex items-center justify-center gap-2 text-gray-400">
										<div className="w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
										<span className="text-sm">Searching...</span>
									</div>
								</div>
							)}
						</div>

						<LoadingButton
							type="submit"
							disabled={isSubmitting}
							isLoading={isSubmitting}
							className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
						>
							<LogIn size={20} />
							Sign in
						</LoadingButton>

						<p className="text-center text-sm text-gray-400">
							Don&apos;t have an account?{" "}
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
