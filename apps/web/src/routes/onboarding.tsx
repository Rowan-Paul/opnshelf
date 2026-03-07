import {
	authControllerMeOptions,
	listsControllerGetUserListsOptions,
	shelfControllerGetUserShelfOptions,
	usersControllerCompleteOnboardingMutation,
	usersControllerFetchMyTraktPublicHistoryMutation,
	usersControllerGetMySettingsOptions,
	usersControllerImportMyHistoryMutation,
	usersControllerUpdateMyProfileMutation,
	usersControllerUpdateMySettingsMutation,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useId, useMemo, useState } from "react";
import { toast } from "sonner";
import {
	ONBOARDING_STEPS,
	OnboardingContent,
} from "@/components/onboarding/onboarding-content";
import type {
	ImportProgressState,
	OnboardingImportResult,
	TabValue,
} from "@/components/onboarding/types";
import { parseCsvFile, runImportInChunks } from "@/lib/onboarding-import";

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
	const [displayName, setDisplayName] = useState("");
	const [timezone, setTimezone] = useState("UTC");
	const [timeFormat, setTimeFormat] = useState<"12h" | "24h">("24h");
	const displayNameId = useId();
	const timezoneId = useId();
	const fileInputId = useId();
	const [importResult, setImportResult] = useState<OnboardingImportResult>({
		imported: 0,
		skipped: 0,
		failed: 0,
		errors: [],
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

	const { data: settings } = useQuery({
		...usersControllerGetMySettingsOptions(),
		enabled: !!user,
		staleTime: 60_000,
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

	const updateProfileMutation = useMutation({
		...usersControllerUpdateMyProfileMutation(),
		onError: () => {
			toast.error("Could not save profile details");
		},
	});

	const updateSettingsMutation = useMutation({
		...usersControllerUpdateMySettingsMutation(),
		onError: () => {
			toast.error("Could not save time settings");
		},
	});

	const importHistoryMutation = useMutation({
		...usersControllerImportMyHistoryMutation(),
	});

	const progress = useMemo(() => (step / ONBOARDING_STEPS) * 100, [step]);
	const isImporting =
		fetchTraktMutation.isPending || importHistoryMutation.isPending;
	const isImportBusy = isImporting || importProgress.phase === "parsing_csv";
	const importPercent =
		importProgress.totalItems > 0
			? Math.round(
					(importProgress.processedItems / importProgress.totalItems) * 100,
				)
			: 0;
	const userAvatarUrl = typeof user?.avatar === "string" ? user.avatar : "";
	const userDisplayName =
		typeof user?.displayName === "string" ? user.displayName : "";
	const userHandle = typeof user?.handle === "string" ? user.handle : "";
	const isCompleting = completeOnboardingMutation.isPending;
	const isSavingProfile =
		updateProfileMutation.isPending || updateSettingsMutation.isPending;
	const needsAuthRedirect = !isAuthLoading && !user;
	const needsShelfRedirect = !isAuthLoading && !!user && !user.needsOnboarding;

	useEffect(() => {
		if (needsAuthRedirect) {
			navigate({ to: "/login", search: { redirect: "/onboarding" } });
			return;
		}

		if (needsShelfRedirect) {
			navigate({ to: "/" });
		}
	}, [navigate, needsAuthRedirect, needsShelfRedirect]);

	useEffect(() => {
		if (!user) {
			return;
		}
		setDisplayName(userDisplayName || userHandle);
	}, [user, userDisplayName, userHandle]);

	useEffect(() => {
		if (!settings) {
			return;
		}
		setTimezone(settings.timezone);
		setTimeFormat(settings.timeFormat === "12h" ? "12h" : "24h");
	}, [settings]);

	if (isAuthLoading) {
		return (
			<div className="flex-1 flex items-center justify-center">
				<div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin border-(--md-sys-color-primary)" />
			</div>
		);
	}

	if (needsAuthRedirect || needsShelfRedirect || !user) {
		return null;
	}

	const handleSaveProfileAndContinue = async () => {
		await updateProfileMutation.mutateAsync({
			body: {
				displayName: displayName.trim() || undefined,
			},
		});

		await updateSettingsMutation.mutateAsync({
			body: {
				timezone,
				timeFormat,
			},
		});

		toast.success("Profile and time preferences saved");
		setStep(3);
	};

	const completeOnboardingAndRedirect = async () => {
		await completeOnboardingMutation.mutateAsync({});
		queryClient.setQueryData(
			authControllerMeOptions().queryKey,
			(previousUser) => {
				if (!previousUser) {
					return previousUser;
				}

				return {
					...previousUser,
					needsOnboarding: false,
				};
			},
		);

		await queryClient.invalidateQueries({
			predicate: (query) => {
				const key = query.queryKey[0] as { _id?: string } | undefined;
				return (
					key?._id === "shelfControllerGetUserShelf" ||
					key?._id === "listsControllerGetUserLists"
				);
			},
		});

		if (user?.did) {
			await Promise.all([
				queryClient.prefetchQuery(
					shelfControllerGetUserShelfOptions({
						path: { userDid: user.did },
						query: { page: 1, pageSize: 6 },
					}),
				),
				queryClient.prefetchQuery(listsControllerGetUserListsOptions()),
			]);
		}

		navigate({ to: "/", replace: true });
		void queryClient.invalidateQueries({
			queryKey: authControllerMeOptions().queryKey,
		});
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
			setStep(4);
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
			setStep(4);
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Unable to parse CSV file";
			setImportProgress((prev) => ({
				...prev,
				phase: "error",
				message,
			}));
			toast.error(message);
		}
	};

	return (
		<OnboardingContent
			step={step}
			progress={progress}
			activeTab={activeTab}
			traktUsername={traktUsername}
			displayName={displayName}
			timezone={timezone}
			timeFormat={timeFormat}
			displayNameId={displayNameId}
			timezoneId={timezoneId}
			fileInputId={fileInputId}
			userAvatarUrl={userAvatarUrl}
			importProgress={importProgress}
			importPercent={importPercent}
			importResult={importResult}
			isCompleting={isCompleting}
			isSavingProfile={isSavingProfile}
			isImportBusy={isImportBusy}
			onStepChange={setStep}
			onActiveTabChange={setActiveTab}
			onTraktUsernameChange={setTraktUsername}
			onDisplayNameChange={setDisplayName}
			onTimezoneChange={setTimezone}
			onTimeFormatChange={setTimeFormat}
			onSkip={() => {
				void completeOnboardingAndRedirect();
			}}
			onSaveProfileAndContinue={() => {
				void handleSaveProfileAndContinue();
			}}
			onTraktImport={() => {
				void handleTraktImport();
			}}
			onCsvUpload={(file) => {
				void handleCsvUpload(file);
			}}
			onComplete={() => {
				void completeOnboardingAndRedirect();
			}}
		/>
	);
}
