import { authControllerSuggestionsOptions } from "@opnshelf/api";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
	createFileRoute,
	Link,
	useNavigate,
	useSearch,
} from "@tanstack/react-router";
import { ArrowRight, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { UserAvatar } from "#/components/following/UserAvatar";
import { GoogleMark } from "#/components/GoogleMark";
import LoadingState from "#/components/LoadingState";
import Logo from "#/components/Logo";
import { env } from "#/env";
import { useDebounce } from "#/hooks/useDebounce";
import { useAuth } from "#/lib/auth-context";
import { nextIndex } from "#/lib/list-navigation";

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
	const [showSuggestions, setShowSuggestions] = useState(false);
	const [activeIndex, setActiveIndex] = useState(-1);
	const { login, isAuthenticated, isLoading: authLoading } = useAuth();
	const navigate = useNavigate();
	const search = useSearch({ from: "/login" });
	const message = (search as { message?: string }).message;
	const error = (search as { error?: string }).error;
	const inputAreaRef = useRef<HTMLDivElement>(null);

	const debouncedHandle = useDebounce(handle, 300).trim();
	const suggestionsQuery = useQuery({
		...authControllerSuggestionsOptions({ query: { q: debouncedHandle } }),
		enabled: debouncedHandle.length >= 2,
		// Keep the previous query's rows on screen while the next one loads, so
		// typing dims the list instead of replacing it with a spinner.
		placeholderData: keepPreviousData,
	});
	const suggestions = suggestionsQuery.data ?? [];
	// Only the very first search has nothing to show, so that is the only time a
	// spinner beats stale rows.
	const isSearchingEmpty =
		suggestionsQuery.isFetching && suggestions.length === 0;
	const shouldShowSuggestions = showSuggestions && debouncedHandle.length >= 2;
	const listId = "handle-suggestions";

	// Redirect if already authenticated
	useEffect(() => {
		if (isAuthenticated) {
			navigate({ to: "/" });
		}
	}, [isAuthenticated, navigate]);

	// Close the suggestions dropdown on outside clicks
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

	const startLogin = (loginHandle: string) => {
		setIsLoading(true);
		login(loginHandle);
	};

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

	// A picked suggestion is a known-resolvable handle, so skip the resolve
	// pre-check and go straight to OAuth.
	const handleSuggestionPick = (actorHandle: string) => {
		setHandle(actorHandle);
		setShowSuggestions(false);
		startLogin(actorHandle);
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
							<div ref={inputAreaRef} className="relative">
								<input
									id="handle"
									type="text"
									placeholder="username.bsky.social"
									value={handle}
									onChange={(e) => {
										setHandle(e.target.value);
										setShowSuggestions(true);
										// Typing changes the result set, so the old highlight is
										// meaningless. Start over from nothing highlighted.
										setActiveIndex(-1);
									}}
									onFocus={() => setShowSuggestions(true)}
									onKeyDown={(e) => {
										if (e.key === "Escape") {
											setShowSuggestions(false);
											setActiveIndex(-1);
											return;
										}
										if (e.key === "ArrowDown" || e.key === "ArrowUp") {
											// Stop the caret jumping to either end of the input.
											e.preventDefault();
											setShowSuggestions(true);
											setActiveIndex((current) =>
												nextIndex(
													current,
													suggestions.length,
													e.key === "ArrowDown" ? 1 : -1,
												),
											);
											return;
										}
										// Enter on a highlighted row picks it. With nothing
										// highlighted the form submits the typed handle as before.
										if (e.key === "Enter" && activeIndex >= 0) {
											const actor = suggestions[activeIndex];
											if (actor) {
												e.preventDefault();
												handleSuggestionPick(actor.handle);
											}
										}
									}}
									className="input"
									disabled={isLoading}
									autoComplete="off"
									role="combobox"
									aria-expanded={shouldShowSuggestions}
									aria-controls={listId}
									aria-autocomplete="list"
									aria-activedescendant={
										activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined
									}
								/>
								{shouldShowSuggestions &&
									(isSearchingEmpty || suggestions.length > 0) && (
										<div
											id={listId}
											role="listbox"
											className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-(--border) bg-(--card) shadow-lg"
										>
											{isSearchingEmpty ? (
												<div className="flex items-center justify-center gap-2 p-4 text-(--foreground-muted) text-sm">
													<Loader2 className="size-4 animate-spin" />
													Searching...
												</div>
											) : (
												suggestions.map((actor, index) => (
													<button
														key={actor.did}
														id={`${listId}-${index}`}
														type="button"
														role="option"
														aria-selected={index === activeIndex}
														ref={(el) => {
															if (index === activeIndex) {
																el?.scrollIntoView({ block: "nearest" });
															}
														}}
														onClick={() => handleSuggestionPick(actor.handle)}
														onMouseEnter={() => setActiveIndex(index)}
														className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${index === activeIndex ? "bg-(--background-subtle)" : ""} ${suggestionsQuery.isFetching ? "opacity-60 transition-opacity" : ""}`}
													>
														<UserAvatar
															src={actor.avatar}
															alt={actor.displayName || actor.handle}
															size="sm"
														/>
														<div className="min-w-0 flex-1">
															<div className="truncate font-medium text-sm">
																{actor.displayName || actor.handle}
															</div>
															<div className="truncate text-(--foreground-muted) text-xs">
																@{actor.handle}
															</div>
														</div>
													</button>
												))
											)}
										</div>
									)}
							</div>
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

					<div className="space-y-3">
						{/* Same endpoint as the signup page on purpose. It signs in an
						    account we already know and creates one we don't, and either
						    way it never shows the PDS's invite-code form. */}
						<a
							href={`${env.VITE_API_URL}/auth/google/start`}
							className="btn btn-secondary w-full"
						>
							<GoogleMark className="size-4" />
							Continue with Google
						</a>

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
					</div>
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
