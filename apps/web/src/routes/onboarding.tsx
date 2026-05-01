import {
	getTraktImportStatusMessage,
	getTraktImportStatusProgress,
	isActiveTraktImportStatus,
	isTerminalTraktImportStatus,
	type TraktImportStatusJob,
	usersControllerCompleteOnboarding,
	usersControllerFetchMyTraktPublicHistory,
	usersControllerGetMyCurrentTraktImportOptions,
	usersControllerImportMyBlueskyFollows,
	usersControllerStartMyTraktImport,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	ArrowRight,
	CheckCircle,
	Film,
	Loader2,
	Tv,
	Upload,
	Users,
	X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "#/lib/auth-context";

export const Route = createFileRoute("/onboarding")({
	component: OnboardingPage,
});

type OnboardingStep = "welcome" | "trakt" | "bluesky" | "done";

function TraktAvatar({ url, name }: { url?: string; name: string }) {
	const [error, setError] = useState(false);

	if (!url || error) {
		return (
			<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-(--accent-subtle)">
				<Tv className="size-5 text-(--accent)" />
			</div>
		);
	}

	return (
		<img
			src={url}
			alt={name}
			className="h-10 w-10 shrink-0 rounded-full object-cover"
			referrerPolicy="no-referrer"
			onError={() => setError(true)}
		/>
	);
}

function OnboardingPage() {
	const { user, isAuthenticated, isLoading: authLoading } = useAuth();
	const navigate = useNavigate();
	const [step, setStep] = useState<OnboardingStep>("welcome");
	const hasSetInitialStep = useRef(false);

	// Check for an existing Trakt import job on mount
	const { data: existingImport, isLoading: checkingImport } = useQuery({
		...usersControllerGetMyCurrentTraktImportOptions(),
		enabled: !authLoading && isAuthenticated && !!user?.needsOnboarding,
	});

	useEffect(() => {
		if (hasSetInitialStep.current || authLoading || checkingImport) return;
		hasSetInitialStep.current = true;

		if (existingImport) {
			setStep("trakt");
		}
	}, [authLoading, checkingImport, existingImport]);

	// Redirect unauthenticated users to login
	useEffect(() => {
		if (!authLoading && !isAuthenticated) {
			navigate({ to: "/login" });
		}
	}, [authLoading, isAuthenticated, navigate]);

	// Redirect already onboarded users to dashboard
	useEffect(() => {
		if (!authLoading && isAuthenticated && !user?.needsOnboarding) {
			navigate({ to: "/dashboard" });
		}
	}, [authLoading, isAuthenticated, user?.needsOnboarding, navigate]);

	if (authLoading || checkingImport) {
		return (
			<div className="container-app flex min-h-[calc(100vh-4rem)] items-center justify-center">
				<Loader2 className="size-8 animate-spin text-(--accent)" />
			</div>
		);
	}

	return (
		<div className="container-app flex min-h-[calc(100vh-4rem)] items-center justify-center py-12">
			<div className="w-full max-w-lg">
				{step === "welcome" && <WelcomeStep onNext={() => setStep("trakt")} />}
				{step === "trakt" && (
					<TraktStep
						onNext={() => setStep("bluesky")}
						onSkip={() => setStep("bluesky")}
					/>
				)}
				{step === "bluesky" && (
					<BlueskyStep
						onNext={() => setStep("done")}
						onSkip={() => setStep("done")}
					/>
				)}
				{step === "done" && <DoneStep />}
			</div>
		</div>
	);
}

/* ------------------------------------------------------------------
   Step 1: Welcome
   ------------------------------------------------------------------ */
function WelcomeStep({ onNext }: { onNext: () => void }) {
	return (
		<div className="card p-8 text-center">
			<div className="mb-6 flex justify-center">
				<div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-(--accent) text-[#3f2e00]">
					<Film className="size-8" />
				</div>
			</div>
			<h1 className="mb-3 text-display-2">Welcome to OpnShelf</h1>
			<p className="mx-auto mb-8 max-w-sm text-(--foreground-muted)">
				Let&apos;s get you set up in just a few steps. You can import your watch
				history and connect with friends already here.
			</p>
			<button type="button" onClick={onNext} className="btn btn-primary w-full">
				Get Started
				<ArrowRight className="size-4" />
			</button>
		</div>
	);
}

/* ------------------------------------------------------------------
   Step 2: Trakt.tv Import
   ------------------------------------------------------------------ */
function TraktStep({
	onNext,
	onSkip,
}: {
	onNext: () => void;
	onSkip: () => void;
}) {
	const [username, setUsername] = useState("");
	const [previewData, setPreviewData] = useState<{
		profile: { username: string; name?: string; avatarUrl?: string };
		importableCount: number;
		previewItems: Array<{
			type: "movie" | "episode";
			title: string;
			subtitle?: string;
			watchedAt: string;
		}>;
	} | null>(null);
	const [jobData, setJobData] = useState<TraktImportStatusJob | null>(null);
	const [fetchError, setFetchError] = useState("");
	const queryClient = useQueryClient();

	const fetchPreview = useMutation({
		mutationFn: async (body: { username: string }) => {
			const { data } = await usersControllerFetchMyTraktPublicHistory({
				body,
				throwOnError: true,
			});
			return data;
		},
		onSuccess: (data) => {
			setPreviewData(data);
			setFetchError("");
		},
		onError: (error: unknown) => {
			const message =
				typeof error === "object" && error !== null && "message" in error
					? String((error as { message?: string }).message)
					: "Could not fetch Trakt history. Please check the username and try again.";
			setFetchError(message);
		},
	});

	const startImport = useMutation({
		mutationFn: async (body: { username: string }) => {
			const { data } = await usersControllerStartMyTraktImport({
				body,
				throwOnError: true,
			});
			return data;
		},
		onSuccess: (data) => {
			if (data.job) {
				setJobData({
					status: data.job.status,
					currentPage: data.job.currentPage,
					totalPages: data.job.totalPages,
					importedCount: data.job.importedCount,
					skippedCount: data.job.skippedCount,
					failedCount: data.job.failedCount,
					lastError: data.job.lastError,
				});
			}
		},
	});

	// Poll current import status when there's an active job
	const { data: currentImport } = useQuery({
		...usersControllerGetMyCurrentTraktImportOptions(),
		enabled: !!jobData && isActiveTraktImportStatus(jobData.status),
		refetchInterval: 3000,
	});

	useEffect(() => {
		if (currentImport) {
			setJobData({
				status: currentImport.status,
				currentPage: currentImport.currentPage,
				totalPages: currentImport.totalPages,
				importedCount: currentImport.importedCount,
				skippedCount: currentImport.skippedCount,
				failedCount: currentImport.failedCount,
				lastError: currentImport.lastError,
			});
		}
	}, [currentImport]);

	const handleFetch = () => {
		if (!username.trim()) return;
		setPreviewData(null);
		setJobData(null);
		fetchPreview.mutate({ username: username.trim() });
	};

	const handleStartImport = () => {
		if (!username.trim()) return;
		startImport.mutate({ username: username.trim() });
	};

	const isImportDone = jobData && isTerminalTraktImportStatus(jobData.status);
	const progress = jobData ? getTraktImportStatusProgress(jobData) : null;
	const statusMessage = jobData ? getTraktImportStatusMessage(jobData) : null;

	return (
		<div className="card p-6">
			<div className="mb-6 flex items-center justify-between">
				<div>
					<h2 className="text-display-3">Import from Trakt</h2>
					<p className="mt-1 text-(--foreground-muted) text-sm">
						Import your public watch history from Trakt.tv
					</p>
				</div>
				{!jobData && (
					<button
						type="button"
						onClick={onSkip}
						className="text-(--foreground-muted) text-sm hover:text-(--foreground)"
					>
						Skip
					</button>
				)}
			</div>

			{/* Username input */}
			{!previewData && !jobData && (
				<div className="space-y-4">
					<div>
						<label
							htmlFor="trakt-username"
							className="mb-1.5 block font-medium text-sm"
						>
							Trakt Username
						</label>
						<input
							id="trakt-username"
							type="text"
							placeholder="your-trakt-username"
							value={username}
							onChange={(e) => setUsername(e.target.value)}
							className="input"
							onKeyDown={(e) => {
								if (e.key === "Enter") handleFetch();
							}}
						/>
					</div>
					{fetchError && <p className="text-red-500 text-sm">{fetchError}</p>}
					<button
						type="button"
						onClick={handleFetch}
						disabled={fetchPreview.isPending || !username.trim()}
						className="btn btn-primary w-full"
					>
						{fetchPreview.isPending ? (
							<>
								<Loader2 className="size-4 animate-spin" />
								Fetching preview...
							</>
						) : (
							<>
								<Upload className="size-4" />
								Preview History
							</>
						)}
					</button>
				</div>
			)}

			{/* Preview results */}
			{previewData && !jobData && (
				<div className="space-y-4">
					<div className="flex items-center gap-3 rounded-lg bg-(--background-subtle) p-3">
						<TraktAvatar
							url={previewData.profile.avatarUrl}
							name={previewData.profile.username}
						/>
						<div>
							<p className="font-medium text-sm">
								{previewData.profile.name || previewData.profile.username}
							</p>
							<p className="text-(--foreground-muted) text-xs">
								@{previewData.profile.username}
							</p>
						</div>
					</div>

					{previewData.previewItems.length > 0 && (
						<div className="space-y-2">
							<p className="font-medium text-sm">Recent items</p>
							{previewData.previewItems.map((item) => (
								<div
									key={`${item.title}-${item.watchedAt}`}
									className="flex items-center gap-3 rounded-lg border border-(--border) bg-(--background-elevated) p-3"
								>
									<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-(--accent-subtle)">
										{item.type === "movie" ? (
											<Film className="size-4 text-(--accent)" />
										) : (
											<Tv className="size-4 text-(--accent)" />
										)}
									</div>
									<div className="min-w-0 flex-1">
										<p className="truncate text-sm">{item.title}</p>
										{item.subtitle && (
											<p className="truncate text-(--foreground-muted) text-xs">
												{item.subtitle}
											</p>
										)}
									</div>
								</div>
							))}
						</div>
					)}

					<div className="flex gap-3">
						<button
							type="button"
							onClick={() => {
								setPreviewData(null);
								setUsername("");
							}}
							className="btn btn-secondary flex-1"
						>
							<X className="size-4" />
							Change
						</button>
						<button
							type="button"
							onClick={handleStartImport}
							disabled={startImport.isPending}
							className="btn btn-primary flex-1"
						>
							{startImport.isPending ? (
								<Loader2 className="size-4 animate-spin" />
							) : (
								<>
									<Upload className="size-4" />
									Start Import
								</>
							)}
						</button>
					</div>
				</div>
			)}

			{/* Import progress */}
			{jobData && (
				<div className="space-y-4">
					<div className="flex items-center gap-3">
						{isImportDone ? (
							<CheckCircle className="size-5 text-green-500" />
						) : (
							<Loader2 className="size-5 animate-spin text-(--accent)" />
						)}
						<div>
							<p className="font-medium text-sm">
								{isImportDone ? "Import finished" : "Importing..."}
							</p>
							{statusMessage && (
								<p className="text-(--foreground-muted) text-xs">
									{statusMessage}
								</p>
							)}
						</div>
					</div>

					{typeof progress === "number" && (
						<div className="space-y-1">
							<div className="h-2 w-full overflow-hidden rounded-full bg-(--background-subtle)">
								<div
									className="h-full rounded-full bg-(--accent) transition-all duration-500"
									style={{ width: `${progress}%` }}
								/>
							</div>
							<p className="text-right text-(--foreground-muted) text-xs">
								{progress}%
							</p>
						</div>
					)}

					{isImportDone && (
						<button
							type="button"
							onClick={() => {
								setJobData(null);
								setPreviewData(null);
								setUsername("");
								// Invalidate shelf so the user sees imported items
								queryClient.invalidateQueries({ queryKey: ["shelf"] });
								onNext();
							}}
							className="btn btn-primary w-full"
						>
							Continue
							<ArrowRight className="size-4" />
						</button>
					)}
				</div>
			)}
		</div>
	);
}

/* ------------------------------------------------------------------
   Step 3: Bluesky Follows
   ------------------------------------------------------------------ */
function BlueskyStep({
	onNext,
	onSkip,
}: {
	onNext: () => void;
	onSkip: () => void;
}) {
	const [result, setResult] = useState<{
		scannedCount: number;
		matchedCount: number;
		createdCount: number;
		alreadyFollowingCount: number;
	} | null>(null);

	const importFollows = useMutation({
		mutationFn: async () => {
			const { data } = await usersControllerImportMyBlueskyFollows({
				throwOnError: true,
			});
			return data;
		},
		onSuccess: (data) => {
			setResult(data);
		},
	});

	return (
		<div className="card p-6">
			<div className="mb-6 flex items-center justify-between">
				<div>
					<h2 className="text-display-3">Connect with Friends</h2>
					<p className="mt-1 text-(--foreground-muted) text-sm">
						Import your Bluesky follows who are already on OpnShelf
					</p>
				</div>
				<button
					type="button"
					onClick={onSkip}
					className="text-(--foreground-muted) text-sm hover:text-(--foreground)"
				>
					Skip
				</button>
			</div>

			{!result && (
				<div className="space-y-4">
					<div className="flex items-center gap-3 rounded-lg bg-(--background-subtle) p-4">
						<div className="flex h-10 w-10 items-center justify-center rounded-full bg-(--accent-subtle)">
							<Users className="size-5 text-(--accent)" />
						</div>
						<div>
							<p className="font-medium text-sm">
								Find people you follow on Bluesky
							</p>
							<p className="text-(--foreground-muted) text-xs">
								We&apos;ll scan your follows and auto-follow anyone already
								here.
							</p>
						</div>
					</div>

					<button
						type="button"
						onClick={() => importFollows.mutate()}
						disabled={importFollows.isPending}
						className="btn btn-primary w-full"
					>
						{importFollows.isPending ? (
							<>
								<Loader2 className="size-4 animate-spin" />
								Scanning follows...
							</>
						) : (
							<>
								<Users className="size-4" />
								Import Bluesky Follows
							</>
						)}
					</button>
				</div>
			)}

			{result && (
				<div className="space-y-4">
					<div className="flex items-center gap-3">
						<CheckCircle className="size-5 text-green-500" />
						<p className="font-medium text-sm">Follows imported</p>
					</div>

					<div className="grid grid-cols-2 gap-3">
						<div className="rounded-lg bg-(--background-subtle) p-3 text-center">
							<p className="text-display-3">{result.scannedCount}</p>
							<p className="text-(--foreground-muted) text-xs">Scanned</p>
						</div>
						<div className="rounded-lg bg-(--background-subtle) p-3 text-center">
							<p className="text-display-3">{result.matchedCount}</p>
							<p className="text-(--foreground-muted) text-xs">Matched</p>
						</div>
						<div className="rounded-lg bg-(--background-subtle) p-3 text-center">
							<p className="text-display-3">{result.createdCount}</p>
							<p className="text-(--foreground-muted) text-xs">New follows</p>
						</div>
						<div className="rounded-lg bg-(--background-subtle) p-3 text-center">
							<p className="text-display-3">{result.alreadyFollowingCount}</p>
							<p className="text-(--foreground-muted) text-xs">
								Already following
							</p>
						</div>
					</div>

					<button
						type="button"
						onClick={onNext}
						className="btn btn-primary w-full"
					>
						Continue
						<ArrowRight className="size-4" />
					</button>
				</div>
			)}
		</div>
	);
}

/* ------------------------------------------------------------------
   Step 4: Done
   ------------------------------------------------------------------ */
function DoneStep() {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { user } = useAuth();

	const completeOnboarding = useMutation({
		mutationFn: async () => {
			const { data } = await usersControllerCompleteOnboarding({
				throwOnError: true,
			});
			return data;
		},
		onSuccess: () => {
			// Invalidate user data so needsOnboarding updates
			queryClient.invalidateQueries({ queryKey: ["authControllerMe"] });
			// Give a moment then redirect
			setTimeout(() => {
				navigate({ to: "/dashboard" });
			}, 800);
		},
	});

	useEffect(() => {
		// Auto-complete onboarding when this step mounts
		completeOnboarding.mutate();
	}, [completeOnboarding.mutate]);

	return (
		<div className="card p-8 text-center">
			<div className="mb-6 flex justify-center">
				<div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
					<CheckCircle className="size-8 text-green-500" />
				</div>
			</div>
			<h2 className="mb-2 text-display-2">You&apos;re all set!</h2>
			<p className="mx-auto mb-6 max-w-sm text-(--foreground-muted)">
				Welcome to OpnShelf{user?.displayName ? `, ${user.displayName}` : ""}.
				Start tracking what you watch and discover what your friends are into.
			</p>
			{completeOnboarding.isPending ? (
				<div className="flex items-center justify-center gap-2 text-(--foreground-muted) text-sm">
					<Loader2 className="size-4 animate-spin" />
					Finishing up...
				</div>
			) : (
				<button
					type="button"
					onClick={() => navigate({ to: "/dashboard" })}
					className="btn btn-primary inline-flex"
				>
					Go to Dashboard
					<ArrowRight className="size-4" />
				</button>
			)}
		</div>
	);
}
