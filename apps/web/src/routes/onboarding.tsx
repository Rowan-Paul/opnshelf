import {
	authControllerMeOptions,
	type NormalizedImportItemDto,
	usersControllerCompleteOnboardingMutation,
	usersControllerFetchMyTraktPublicHistoryMutation,
	usersControllerImportMyHistoryMutation,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import Papa from "papaparse";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { M3Button } from "@/components/ui/m3-button";

type TabValue = "trakt" | "csv";
type CsvParseError = { row: number; message: string };
type ImportPhase =
	| "idle"
	| "fetching_trakt"
	| "parsing_csv"
	| "importing"
	| "done"
	| "error";

type ImportProgressState = {
	phase: ImportPhase;
	totalItems: number;
	processedItems: number;
	currentBatch: number;
	totalBatches: number;
	imported: number;
	skipped: number;
	failed: number;
	startedAt: number | null;
	message: string;
};

type ImportProgressUpdate = {
	totalItems: number;
	processedItems: number;
	currentBatch: number;
	totalBatches: number;
	imported: number;
	skipped: number;
	failed: number;
};

const MAX_BATCH_SIZE = 25;
const CSV_HEADERS = [
	"watched_at",
	"action",
	"type",
	"tmdb_id",
	"season_number",
	"episode_number",
] as const;

export const Route = createFileRoute("/onboarding")({
	head: () => ({
		meta: [{ title: "Welcome | OpnShelf" }],
	}),
	component: OnboardingPage,
});

function OnboardingPage() {
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const [step, setStep] = useState(1);
	const [activeTab, setActiveTab] = useState<TabValue>("trakt");
	const [traktUsername, setTraktUsername] = useState("");
	const [importResult, setImportResult] = useState({
		imported: 0,
		skipped: 0,
		failed: 0,
		errors: [] as string[],
	});
	const [importProgress, setImportProgress] = useState<ImportProgressState>({
		phase: "idle",
		totalItems: 0,
		processedItems: 0,
		currentBatch: 0,
		totalBatches: 0,
		imported: 0,
		skipped: 0,
		failed: 0,
		startedAt: null,
		message: "",
	});

	const { data: user, isLoading: isAuthLoading } = useQuery({
		...authControllerMeOptions(),
		retry: false,
		staleTime: 0,
	});

	const completeOnboardingMutation = useMutation({
		...usersControllerCompleteOnboardingMutation(),
		onError: () => {
			toast.error("Could not complete onboarding");
		},
	});

	const fetchTraktMutation = useMutation({
		...usersControllerFetchMyTraktPublicHistoryMutation(),
	});

	const importHistoryMutation = useMutation({
		...usersControllerImportMyHistoryMutation(),
	});

	const progress = useMemo(() => (step / 3) * 100, [step]);
	const isImporting =
		fetchTraktMutation.isPending || importHistoryMutation.isPending;
	const isImportBusy = isImporting || importProgress.phase === "parsing_csv";
	const importPercent =
		importProgress.totalItems > 0
			? Math.round((importProgress.processedItems / importProgress.totalItems) * 100)
			: 0;
	const isCompleting = completeOnboardingMutation.isPending;
	const needsAuthRedirect = !isAuthLoading && !user;
	const needsShelfRedirect = !isAuthLoading && !!user && !user.needsOnboarding;

	useEffect(() => {
		if (needsAuthRedirect) {
			navigate({ to: "/login", search: { redirect: "/onboarding" } });
			return;
		}

		if (needsShelfRedirect) {
			navigate({ to: "/profile/shelf" });
		}
	}, [navigate, needsAuthRedirect, needsShelfRedirect]);

	if (isAuthLoading) {
		return (
			<div className="flex-1 flex items-center justify-center">
				<div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin border-[var(--md-sys-color-primary)]" />
			</div>
		);
	}

	if (needsAuthRedirect || needsShelfRedirect || !user) {
		return null;
	}

	const handleSkip = async () => {
		await completeOnboardingAndRedirect();
	};

	const completeOnboardingAndRedirect = async () => {
		await completeOnboardingMutation.mutateAsync({});
		queryClient.setQueryData(authControllerMeOptions().queryKey, (previousUser) => {
			if (!previousUser) {
				return previousUser;
			}

			return {
				...previousUser,
				needsOnboarding: false,
			};
		});

		navigate({ to: "/profile/shelf", replace: true });
		void queryClient.invalidateQueries({ queryKey: authControllerMeOptions().queryKey });
	};

	const handleTraktImport = async () => {
		const username = traktUsername.trim();
		if (!username) {
			toast.error("Enter your Trakt username");
			return;
		}

		try {
			setImportProgress({
				phase: "fetching_trakt",
				totalItems: 0,
				processedItems: 0,
				currentBatch: 0,
				totalBatches: 0,
				imported: 0,
				skipped: 0,
				failed: 0,
				startedAt: Date.now(),
				message: "Fetching public history from Trakt...",
			});

			const fetched = await fetchTraktMutation.mutateAsync({
				body: {
					username,
				},
			});

			if (!fetched.items.length) {
				setImportResult({
					imported: 0,
					skipped: fetched.skipped.length,
					failed: 0,
					errors: [],
				});
				setImportProgress((prev) => ({
					...prev,
					phase: "done",
					message: "No importable items found.",
				}));
				toast.message("No supported watch history items found");
				return;
			}

			const result = await runImportInChunks(
				fetched.items,
				importHistoryMutation.mutateAsync,
				(update) => {
					setImportProgress((prev) => ({
						...prev,
						phase: "importing",
						message: "Importing history...",
						...update,
					}));
				},
			);
			setImportResult(result);
			setImportProgress((prev) => ({
				...prev,
				phase: "done",
				message: "Import complete.",
			}));
			setStep(3);
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: "Unable to fetch Trakt history right now";
			setImportProgress((prev) => ({
				...prev,
				phase: "error",
				message,
			}));
			toast.error(message);
		}
	};

	const handleCsvUpload = async (file: File) => {
		try {
			setImportProgress({
				phase: "parsing_csv",
				totalItems: 0,
				processedItems: 0,
				currentBatch: 0,
				totalBatches: 0,
				imported: 0,
				skipped: 0,
				failed: 0,
				startedAt: Date.now(),
				message: "Parsing CSV file...",
			});

			const { items, errors } = await parseCsvFile(file);
			if (!items.length) {
				setImportResult({
					imported: 0,
					skipped: 0,
					failed: errors.length,
					errors: errors.map((entry) => entry.message),
				});
				setImportProgress((prev) => ({
					...prev,
					phase: "error",
					failed: errors.length,
					message: "No valid rows found in CSV.",
				}));
				toast.error("No valid rows found in CSV");
				return;
			}

			const imported = await runImportInChunks(
				items,
				importHistoryMutation.mutateAsync,
				(update) => {
					setImportProgress((prev) => ({
						...prev,
						phase: "importing",
						message: "Importing history...",
						...update,
					}));
				},
			);

			setImportResult({
				imported: imported.imported,
				skipped: imported.skipped,
				failed: imported.failed + errors.length,
				errors: [...errors.map((entry) => entry.message), ...imported.errors],
			});
			setImportProgress((prev) => ({
				...prev,
				phase: "done",
				failed: imported.failed + errors.length,
				message: "Import complete.",
			}));
			setStep(3);
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: "Unable to parse CSV file";
			setImportProgress((prev) => ({
				...prev,
				phase: "error",
				message,
			}));
			toast.error(message);
		}
	};

	return (
		<div className="flex-1 flex items-center justify-center p-4">
			<div className="w-full max-w-3xl rounded-(--md-sys-shape-corner-large) border p-6 md:p-8 bg-(--md-sys-color-surface)">
				<h1 className="md-headline-large mb-2">Welcome to OpnShelf</h1>
				<p className="md-body-large text-(--md-sys-color-on-surface-variant)">
					Bring your watch history over, or skip and start tracking now.
				</p>

				<div className="h-2 rounded-full mt-6 mb-8 bg-(--md-sys-color-surface-container)">
					<div
						className="h-2 rounded-full transition-all"
						style={{
							width: `${progress}%`,
							backgroundColor: "var(--md-sys-color-primary)",
						}}
					/>
				</div>

				{step === 1 && (
					<div className="space-y-5">
						<p className="md-body-large text-(--md-sys-color-on-surface-variant)">
							Step 1 of 3: We can import your existing watches from Trakt or from
							 a CSV export.
						</p>
						<div className="flex gap-3">
							<M3Button variant="filled" onClick={() => setStep(2)}>
								Start import
							</M3Button>
							<M3Button
								variant="text"
								onClick={handleSkip}
								disabled={isCompleting}
							>
								{isCompleting ? "Finishing..." : "Skip for now"}
							</M3Button>
						</div>
					</div>
				)}

				{step === 2 && (
					<div className="space-y-4">
						{importProgress.phase !== "idle" && (
							<div className="rounded-(--md-sys-shape-corner-medium) border p-3 space-y-2 bg-(--md-sys-color-surface-container-low)">
								<p className="md-label-large">{importProgress.message}</p>
								{importProgress.phase === "importing" ? (
									<>
										<div className="h-2 rounded-full bg-(--md-sys-color-surface-container)">
											<div
												className="h-2 rounded-full transition-all"
												style={{
													width: `${importPercent}%`,
													backgroundColor: "var(--md-sys-color-primary)",
												}}
											/>
										</div>
										<p className="md-body-small text-(--md-sys-color-on-surface-variant)">
											{importProgress.processedItems} / {importProgress.totalItems} items
											 ({importPercent}%)
										</p>
										<p className="md-body-small text-(--md-sys-color-on-surface-variant)">
											Batch {importProgress.currentBatch} / {importProgress.totalBatches}
											 · Imported {importProgress.imported} · Skipped{" "}
											{importProgress.skipped} · Failed {importProgress.failed}
										</p>
									</>
								) : (
									<p className="md-body-small text-(--md-sys-color-on-surface-variant)">
										Preparing import...
									</p>
								)}
							</div>
						)}

						<div className="flex gap-2">
							<button
								type="button"
								onClick={() => setActiveTab("trakt")}
								className="px-3 py-2 rounded-(--md-sys-shape-corner-medium)"
								style={{
									backgroundColor:
										activeTab === "trakt"
											? "var(--md-sys-color-secondary-container)"
											: "var(--md-sys-color-surface-container)",
								}}
							>
								Trakt username
							</button>
							<button
								type="button"
								onClick={() => setActiveTab("csv")}
								className="px-3 py-2 rounded-(--md-sys-shape-corner-medium)"
								style={{
									backgroundColor:
										activeTab === "csv"
											? "var(--md-sys-color-secondary-container)"
											: "var(--md-sys-color-surface-container)",
								}}
							>
								CSV upload
							</button>
						</div>

						{activeTab === "trakt" ? (
							<div className="space-y-3">
								<input
									type="text"
									value={traktUsername}
									onChange={(event) => setTraktUsername(event.target.value)}
									placeholder="Trakt username"
									className="w-full rounded-(--md-sys-shape-corner-medium) border px-3 py-2"
								/>
								<M3Button
									variant="filled"
									onClick={handleTraktImport}
									disabled={isImportBusy}
								>
									Fetch and import
								</M3Button>
							</div>
						) : (
							<div className="space-y-3">
								<input
									type="file"
									accept=".csv,text/csv"
									onChange={(event) => {
										const file = event.target.files?.[0];
										if (file) {
											void handleCsvUpload(file);
										}
									}}
									disabled={isImportBusy}
								/>
								<p className="md-body-small text-(--md-sys-color-on-surface-variant)">
									Upload a Trakt history CSV export using the standard Trakt columns.
								</p>
							</div>
						)}

						<div className="flex gap-3">
							<M3Button variant="text" onClick={() => setStep(1)} disabled={isImportBusy}>
								Back
							</M3Button>
							<M3Button
								variant="text"
								onClick={handleSkip}
								disabled={isCompleting || isImportBusy}
							>
								{isCompleting ? "Finishing..." : "Skip for now"}
							</M3Button>
						</div>
					</div>
				)}

				{step === 3 && (
					<div className="space-y-4">
						<h2 className="md-title-large">You&apos;re all set</h2>
						<p className="md-body-medium text-(--md-sys-color-on-surface-variant)">
							Imported: {importResult.imported} | Skipped: {importResult.skipped} |
							 Failed: {importResult.failed}
						</p>
						{importResult.errors.length > 0 && (
							<div className="rounded-(--md-sys-shape-corner-medium) border p-3 max-h-56 overflow-auto">
							<p className="md-label-large mb-2">Errors</p>
							<ul className="space-y-1">
								{importResult.errors.map((error) => (
									<li key={error} className="md-body-small">
										{error}
									</li>
									))}
								</ul>
							</div>
						)}
						<M3Button
							variant="filled"
							onClick={() => {
								void completeOnboardingAndRedirect();
							}}
							disabled={isCompleting}
						>
							{isCompleting ? "Finishing..." : "Finish"}
						</M3Button>
					</div>
				)}
			</div>
		</div>
	);
}

async function runImportInChunks(
	items: NormalizedImportItemDto[],
	importMutate: (payload: {
		body: { items: NormalizedImportItemDto[] };
	}) => Promise<{
		imported: number;
		skipped: number;
		failed: number;
		errors: Array<{ message: string }>;
	}>,
	onProgress?: (update: ImportProgressUpdate) => void,
) {
	let imported = 0;
	let skipped = 0;
	let failed = 0;
	const errors: string[] = [];
	const totalItems = items.length;
	const totalBatches = Math.ceil(totalItems / MAX_BATCH_SIZE);

	onProgress?.({
		totalItems,
		processedItems: 0,
		currentBatch: 0,
		totalBatches,
		imported,
		skipped,
		failed,
	});

	for (let start = 0; start < totalItems; start += MAX_BATCH_SIZE) {
		const currentBatch = Math.floor(start / MAX_BATCH_SIZE) + 1;
		const chunk = items.slice(start, start + MAX_BATCH_SIZE);

		onProgress?.({
			totalItems,
			processedItems: start,
			currentBatch,
			totalBatches,
			imported,
			skipped,
			failed,
		});

		const result = await importMutate({ body: { items: chunk } });
		imported += result.imported;
		skipped += result.skipped;
		failed += result.failed;
		errors.push(...result.errors.map((error) => error.message));

		onProgress?.({
			totalItems,
			processedItems: Math.min(start + chunk.length, totalItems),
			currentBatch,
			totalBatches,
			imported,
			skipped,
			failed,
		});
	}

	return {
		imported,
		skipped,
		failed,
		errors,
	};
}

async function parseCsvFile(file: File): Promise<{
	items: NormalizedImportItemDto[];
	errors: CsvParseError[];
}> {
	return new Promise((resolve, reject) => {
		Papa.parse<Record<string, string>>(file, {
			header: true,
			skipEmptyLines: true,
			complete: (results) => {
				const items: NormalizedImportItemDto[] = [];
				const errors: CsvParseError[] = [];
				const headers = (results.meta.fields ?? []).map((header) =>
					header.trim(),
				);

				for (const expectedHeader of CSV_HEADERS) {
					if (!headers.includes(expectedHeader)) {
						errors.push({
							row: 1,
							message: `Missing required header: ${expectedHeader}`,
						});
					}
				}

				if (errors.length > 0) {
					resolve({ items, errors });
					return;
				}

				for (let rowIndex = 0; rowIndex < results.data.length; rowIndex++) {
					const row = results.data[rowIndex] ?? {};
					const normalized = normalizeCsvRow(row, rowIndex + 2);
					if (normalized.item) {
						items.push(normalized.item);
					} else if (normalized.error) {
						errors.push(normalized.error);
					}
				}

				resolve({ items, errors });
			},
			error: (error) => {
				reject(error);
			},
		});
	});
}

function normalizeCsvRow(
	row: Record<string, string>,
	rowNumber: number,
): { item?: NormalizedImportItemDto; error?: CsvParseError } {
	const type = getCsvValue(row, "type").toLowerCase();
	const watchedAtRaw = getCsvValue(row, "watched_at");
	const watchedAt = Number.isNaN(Date.parse(watchedAtRaw))
		? ""
		: new Date(watchedAtRaw).toISOString();
	const actionRaw = getCsvValue(row, "action").toLowerCase();
	const action = actionRaw || "watch";

	if (!["watch", "scrobble", "checkin"].includes(action)) {
		return {
			error: {
				row: rowNumber,
				message: `Row ${rowNumber}: unsupported action \"${actionRaw || "unknown"}\"`,
			},
		};
	}

	if (!watchedAt) {
		return { error: { row: rowNumber, message: `Row ${rowNumber}: invalid watched_at` } };
	}

	if (type === "movie") {
		const movieTmdbId = Number.parseInt(getCsvValue(row, "tmdb_id"), 10);
		if (!Number.isInteger(movieTmdbId) || movieTmdbId < 1) {
			return {
				error: { row: rowNumber, message: `Row ${rowNumber}: missing movie TMDB id` },
			};
		}

		return {
			item: {
				type: "movie",
				movieTmdbId,
				action: action as "watch" | "scrobble" | "checkin",
				watchedAt,
			},
		};
	}

	if (type === "episode") {
		const showTmdbId = Number.parseInt(getCsvValue(row, "tmdb_id"), 10);
		const seasonNumber = Number.parseInt(getCsvValue(row, "season_number"), 10);
		const episodeNumber = Number.parseInt(
			getCsvValue(row, "episode_number"),
			10,
		);

		if (!Number.isInteger(showTmdbId) || showTmdbId < 1) {
			return {
				error: { row: rowNumber, message: `Row ${rowNumber}: missing show TMDB id` },
			};
		}

		if (
			!Number.isInteger(seasonNumber) ||
			seasonNumber < 0 ||
			!Number.isInteger(episodeNumber) ||
			episodeNumber < 1
		) {
			return {
				error: {
					row: rowNumber,
					message: `Row ${rowNumber}: invalid season/episode values`,
				},
			};
		}

		return {
			item: {
				type: "episode",
				showTmdbId,
				seasonNumber,
				episodeNumber,
				action: action as "watch" | "scrobble" | "checkin",
				watchedAt,
			},
		};
	}

	return {
		error: {
			row: rowNumber,
			message: `Row ${rowNumber}: unsupported type \"${type || "unknown"}\"`,
		},
	};
}

function getCsvValue(row: Record<string, string>, key: string): string {
	const value = row[key];
	if (typeof value === "string" && value.trim()) {
		return value.trim();
	}
	return "";
}
