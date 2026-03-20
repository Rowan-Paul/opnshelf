import {
	authControllerMeOptions,
	getBlueskyProfileStatus,
	listsControllerGetUserListsOptions,
	shelfControllerGetUserShelfOptions,
	usersControllerCompleteOnboardingMutation,
	usersControllerFetchMyTraktPublicHistoryMutation,
	usersControllerGetMySettingsOptions,
	usersControllerImportMyBlueskyFollowsMutation,
	usersControllerImportMyHistoryMutation,
	usersControllerUpdateMyProfileMutation,
	usersControllerUpdateMySettingsMutation,
	usersControllerUploadMyAvatarMutation,
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
	FollowImportResult,
	FollowImportStatus,
	ImportProgressState,
	OnboardingImportResult,
	TabValue,
	TraktImportPreview,
} from "@/components/onboarding/types";
import {
	getAvatarUploadErrorMessage,
	validateAvatarFile,
} from "@/lib/avatar-upload";
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
	const createIdleImportProgress = (): ImportProgressState => ({
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
	const [step, setStep] = useState(1);
	const [activeTab, setActiveTab] = useState<TabValue>("trakt");
	const [traktUsername, setTraktUsername] = useState("");
	const [traktPreview, setTraktPreview] = useState<TraktImportPreview | null>(
		null,
	);
	const [displayName, setDisplayName] = useState("");
	const [selectedAvatarFile, setSelectedAvatarFile] = useState<File | null>(
		null,
	);
	const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
	const [avatarErrorMessage, setAvatarErrorMessage] = useState<string | null>(
		null,
	);
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
	const [followImportStatus, setFollowImportStatus] =
		useState<FollowImportStatus>("idle");
	const [followImportResult, setFollowImportResult] =
		useState<FollowImportResult | null>(null);
	const [importProgress, setImportProgress] = useState<ImportProgressState>(
		createIdleImportProgress(),
	);

	const { data: user, isLoading: isAuthLoading } = useQuery({
		...authControllerMeOptions(),
		retry: false,
		staleTime: 0,
	});
	const shouldLoadBlueskyProfileStatus =
		Boolean(user) && user?.needsOnboarding === true;
	const {
		data: blueskyProfileStatus,
		isLoading: isBlueskyProfileStatusLoading,
	} = useQuery({
		queryKey: ["auth", "me", "bluesky-profile-status"],
		queryFn: getBlueskyProfileStatus,
		enabled: shouldLoadBlueskyProfileStatus,
		retry: false,
		staleTime: 0,
	});

	const { data: settings } = useQuery({
		...usersControllerGetMySettingsOptions(),
		enabled: !!user,
		staleTime: 60_000,
	});

	const completeOnboardingMutation = useMutation({
		mutationKey: ["users", "onboarding", "complete"],
		...usersControllerCompleteOnboardingMutation(),
		onError: () => {
			toast.error("Could not complete onboarding");
		},
	});

	const fetchTraktMutation = useMutation({
		mutationKey: ["users", "trakt", "history", "fetch"],
		...usersControllerFetchMyTraktPublicHistoryMutation(),
	});

	const importBlueskyFollowsMutation = useMutation({
		mutationKey: ["users", "bluesky", "follows", "import"],
		...usersControllerImportMyBlueskyFollowsMutation(),
	});

	const updateProfileMutation = useMutation({
		mutationKey: ["users", "profile", "update"],
		...usersControllerUpdateMyProfileMutation(),
		onError: () => {
			toast.error("Could not save profile details");
		},
	});

	const updateSettingsMutation = useMutation({
		mutationKey: ["users", "settings", "update"],
		...usersControllerUpdateMySettingsMutation(),
		onError: () => {
			toast.error("Could not save time settings");
		},
	});

	const importHistoryMutation = useMutation({
		mutationKey: ["users", "history", "import"],
		...usersControllerImportMyHistoryMutation(),
	});
	const uploadAvatarMutation = useMutation({
		mutationKey: ["users", "profile", "avatar", "upload"],
		...usersControllerUploadMyAvatarMutation(),
		onError: (error) => {
			setAvatarErrorMessage(
				getAvatarUploadErrorMessage(error, "Could not upload profile photo"),
			);
		},
	});

	const userAvatarUrl = typeof user?.avatar === "string" ? user.avatar : "";
	const userDisplayName =
		typeof user?.displayName === "string" ? user.displayName : "";
	const userHandle = typeof user?.handle === "string" ? user.handle : "";
	const hasBlueskyProfile = blueskyProfileStatus?.hasBlueskyProfile === true;
	const visibleStep = hasBlueskyProfile ? step : step >= 4 ? step - 1 : step;
	const totalSteps = hasBlueskyProfile
		? ONBOARDING_STEPS
		: ONBOARDING_STEPS - 1;
	const progress = useMemo(
		() => (visibleStep / totalSteps) * 100,
		[totalSteps, visibleStep],
	);
	const isImporting =
		fetchTraktMutation.isPending || importHistoryMutation.isPending;
	const isImportBusy = isImporting || importProgress.phase === "parsing_csv";
	const importPercent =
		importProgress.totalItems > 0
			? Math.round(
					(importProgress.processedItems / importProgress.totalItems) * 100,
				)
			: 0;
	const isCompleting = completeOnboardingMutation.isPending;
	const isSavingProfile =
		updateProfileMutation.isPending ||
		updateSettingsMutation.isPending ||
		uploadAvatarMutation.isPending;
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
		if (!selectedAvatarFile) {
			setAvatarPreviewUrl(userAvatarUrl || null);
			return;
		}

		const objectUrl = URL.createObjectURL(selectedAvatarFile);
		setAvatarPreviewUrl(objectUrl);
		return () => {
			URL.revokeObjectURL(objectUrl);
		};
	}, [selectedAvatarFile, userAvatarUrl]);

	useEffect(() => {
		if (!settings) {
			return;
		}
		setTimezone(settings.timezone);
		setTimeFormat(settings.timeFormat === "12h" ? "12h" : "24h");
	}, [settings]);

	useEffect(() => {
		if (!hasBlueskyProfile && step === 3) {
			setStep(4);
		}
	}, [hasBlueskyProfile, step]);

	if (isAuthLoading || isBlueskyProfileStatusLoading) {
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

		if (selectedAvatarFile) {
			await uploadAvatarMutation.mutateAsync({
				body: {
					avatar: selectedAvatarFile,
				},
			});
			setAvatarErrorMessage(null);
		}

		await updateSettingsMutation.mutateAsync({
			body: {
				timezone,
				timeFormat,
			},
		});

		await queryClient.invalidateQueries({
			queryKey: authControllerMeOptions().queryKey,
		});

		toast.success("Profile and time preferences saved");
		setSelectedAvatarFile(null);
		setStep(hasBlueskyProfile ? 3 : 4);
	};

	const handleBlueskyFollowImport = async () => {
		setFollowImportStatus("running");
		try {
			const result = await importBlueskyFollowsMutation.mutateAsync({});
			setFollowImportResult({
				matchedCount: result.matchedCount,
				createdCount: result.createdCount,
				alreadyFollowingCount: result.alreadyFollowingCount,
			});
			setFollowImportStatus("success");
		} catch (error) {
			setFollowImportStatus("error");
			const message =
				error instanceof Error
					? error.message
					: "Could not import Bluesky following";
			toast.error(message);
		}
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
			setTraktPreview(null);
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
			setTraktPreview(fetched);

			setImportProgress((prev) => ({
				...prev,
				phase: "preview_ready",
				totalItems: fetched.importableCount,
				message:
					fetched.importableCount > 0
						? `Preview ready for @${fetched.profile.username}`
						: `No importable items found for @${fetched.profile.username}`,
			}));

			if (!fetched.importableCount) {
				toast.message("No supported watch history items found");
			}
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

	const handleConfirmTraktImport = async () => {
		if (!traktPreview || traktPreview.importableCount < 1) {
			return;
		}

		try {
			const result = await runImportInChunks(
				traktPreview.items,
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
				imported: result.imported,
				skipped: result.skipped + traktPreview.skipped.length,
				failed: result.failed,
				errors: result.errors,
			});
			setImportProgress((prev) => ({
				...prev,
				phase: "done",
				message: "Import complete.",
			}));
			setStep(5);
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: "Unable to import Trakt history right now";
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
			setStep(5);
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
			traktPreview={traktPreview}
			displayName={displayName}
			timezone={timezone}
			timeFormat={timeFormat}
			avatarPreviewUrl={avatarPreviewUrl}
			avatarErrorMessage={avatarErrorMessage}
			displayNameId={displayNameId}
			timezoneId={timezoneId}
			fileInputId={fileInputId}
			hasBlueskyProfile={hasBlueskyProfile}
			followImportStatus={followImportStatus}
			followImportResult={followImportResult}
			importProgress={importProgress}
			importPercent={importPercent}
			importResult={importResult}
			isCompleting={isCompleting}
			isSavingProfile={isSavingProfile}
			isImportBusy={isImportBusy}
			onStepChange={setStep}
			onActiveTabChange={(tab) => {
				setActiveTab(tab);
				if (tab !== "trakt") {
					setTraktPreview(null);
					setImportProgress((prev) =>
						prev.phase === "preview_ready" ? createIdleImportProgress() : prev,
					);
				}
			}}
			onTraktUsernameChange={(value) => {
				setTraktUsername(value);
				if (traktPreview) {
					setTraktPreview(null);
					setImportProgress((prev) =>
						prev.phase === "preview_ready" ? createIdleImportProgress() : prev,
					);
				}
			}}
			onDisplayNameChange={setDisplayName}
			onAvatarChange={(file) => {
				if (!file) {
					setSelectedAvatarFile(null);
					setAvatarErrorMessage(null);
					return;
				}

				const validationMessage = validateAvatarFile(file);
				if (validationMessage) {
					setSelectedAvatarFile(null);
					setAvatarErrorMessage(validationMessage);
					return;
				}

				setAvatarErrorMessage(null);
				setSelectedAvatarFile(file);
			}}
			onTimezoneChange={setTimezone}
			onTimeFormatChange={setTimeFormat}
			onSkipSetup={() => {
				void completeOnboardingAndRedirect();
			}}
			onImportBlueskyFollows={() => {
				void handleBlueskyFollowImport();
			}}
			onSkipFollowImport={() => {
				setStep(4);
			}}
			onContinueAfterFollowImport={() => {
				setStep(4);
			}}
			onSaveProfileAndContinue={() => {
				void handleSaveProfileAndContinue();
			}}
			onTraktImport={() => {
				void handleTraktImport();
			}}
			onTraktImportConfirm={() => {
				void handleConfirmTraktImport();
			}}
			onCsvUpload={(file) => {
				void handleCsvUpload(file);
			}}
			onSkipHistoryImport={() => {
				void completeOnboardingAndRedirect();
			}}
			onComplete={() => {
				void completeOnboardingAndRedirect();
			}}
		/>
	);
}
