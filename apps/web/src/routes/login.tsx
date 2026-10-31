import { authControllerSuggestionsOptions } from "@opnshelf/api";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
	createFileRoute,
	Link,
	useNavigate,
	useSearch,
} from "@tanstack/react-router";
import { ArrowRight, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AppleMark } from "#/components/AppleMark";
import { UserAvatar } from "#/components/following/UserAvatar";
import { GoogleMark } from "#/components/GoogleMark";
import LoadingState from "#/components/LoadingState";
import Logo from "#/components/Logo";
import { env } from "#/env";
import { useDebounce } from "#/hooks/useDebounce";
import { useAuth } from "#/lib/auth-context";
import { nextIndex } from "#/lib/list-navigation";
import {
	forgetAccount,
	noteSignInMethod,
	type RecentAccount,
	type SignInMethod,
	useRecentAccounts,
} from "#/lib/recent-accounts";

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
	const recentAccounts = useRecentAccounts();
	// The row being signed in to, so only that row shows progress.
	const [continuingDid, setContinuingDid] = useState<string | null>(null);
	const busy = isLoading || isSignupLoading || continuingDid !== null;

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

	const handleLogin = (e: React.FormEvent) => {
		e.preventDefault();
		const trimmed = handle.trim();
		if (!trimmed) return;
		// OAuth resolves the handle against the configured identity network.
		// Bluesky's public index cannot validate every PDS or local account.
		startLogin(trimmed);
	};

	// Suggestions and typed handles use the same authoritative OAuth lookup.

	const handleSuggestionPick = (actorHandle: string) => {
		setHandle(actorHandle);
		setShowSuggestions(false);
		startLogin(actorHandle);
	};

	const continueAs = (account: RecentAccount) => {
		setContinuingDid(account.did);
		if (account.method === "handle") {
			login(account.handle);
			return;
		}
		noteSignInMethod(account.method);
		window.location.href = providerStartUrl(account.method);
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
					<h1 className="text-display-2">Welcome back</h1>
				</div>

				{/* Redirect Notice */}
				{message && (
					<div className="mb-6 rounded-lg border border-(--accent) bg-(--accent-subtle) px-4 py-3 text-(--foreground) text-sm">
						{message}
					</div>
				)}

				{/* Login Form */}
				<div className="card p-6">
					{recentAccounts.length > 0 && (
						<>
							<section aria-labelledby="recent-accounts">
								<h2 id="recent-accounts" className="mb-1.5 font-medium text-sm">
									Continue as
								</h2>
								<ul className="divide-y divide-(--border) overflow-hidden rounded-lg border border-(--border)">
									{recentAccounts.map((account) => (
										<li key={account.did} className="flex items-center">
											<button
												type="button"
												onClick={() => continueAs(account)}
												disabled={busy}
												className={`flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 text-left transition-colors enabled:hover:bg-(--background-subtle) ${busy && continuingDid !== account.did ? "opacity-60" : ""}`}
											>
												<UserAvatar src={account.avatar} alt="" size="md" />
												<div className="min-w-0 flex-1">
													<div className="truncate font-medium text-sm">
														{account.displayName || account.handle}
													</div>
													<div className="truncate text-(--foreground-muted) text-xs">
														@{account.handle}
													</div>
												</div>
												{continuingDid === account.did ? (
													<Loader2
														className="size-4 shrink-0 animate-spin text-(--foreground-muted)"
														aria-label="Connecting"
													/>
												) : (
													<MethodMark method={account.method} />
												)}
											</button>
											<button
												type="button"
												onClick={() => forgetAccount(account.did)}
												disabled={busy}
												aria-label={`Remove @${account.handle} from this browser`}
												title="Remove from this browser"
												className="shrink-0 self-stretch px-3 text-(--foreground-muted) transition-colors enabled:hover:bg-(--background-subtle) enabled:hover:text-(--foreground)"
											>
												<X className="size-4" />
											</button>
										</li>
									))}
								</ul>
							</section>

							<div className="my-6 flex items-center gap-4">
								<div className="h-px flex-1 bg-(--border)" />
								<span className="text-(--foreground-muted) text-xs">
									or use another account
								</span>
								<div className="h-px flex-1 bg-(--border)" />
							</div>
						</>
					)}

					<form onSubmit={handleLogin} className="space-y-4">
						<div>
							<label
								htmlFor="handle"
								className="mb-1.5 block font-medium text-sm"
							>
								Handle
							</label>
							<div ref={inputAreaRef} className="relative">
								<input
									id="handle"
									type="text"
									placeholder="bob.opnshelf.social"
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
									disabled={busy}
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
								Already have a Bluesky or AT Protocol handle? That works here
								too.
							</p>
						</div>

						<button
							type="submit"
							disabled={busy || !handle.trim()}
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
							href={providerStartUrl("google")}
							onClick={() => noteSignInMethod("google")}
							className="btn btn-secondary w-full"
						>
							<GoogleMark className="size-4" />
							Continue with Google
						</a>
						<a
							href={providerStartUrl("apple")}
							onClick={() => noteSignInMethod("apple")}
							className="btn btn-secondary w-full"
						>
							<AppleMark className="size-4" />
							Continue with Apple
						</a>

						<button
							type="button"
							onClick={handleSignup}
							disabled={busy}
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
				</div>
			</div>
		</div>
	);
}

function providerStartUrl(provider: Exclude<SignInMethod, "handle">): string {
	return `${env.VITE_API_URL}/auth/${provider}/start`;
}

/** Which provider a remembered account continues with; a Handle gets none. */
function MethodMark({ method }: { method: SignInMethod }) {
	if (method === "handle") return null;
	const name = method === "google" ? "Google" : "Apple";
	const Mark = method === "google" ? GoogleMark : AppleMark;
	return (
		<span className="shrink-0" title={`Continues with ${name}`}>
			<Mark className="size-4" />
			<span className="sr-only">, with {name}</span>
		</span>
	);
}
