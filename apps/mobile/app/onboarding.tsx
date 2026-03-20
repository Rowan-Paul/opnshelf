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
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { ONBOARDING_STEPS } from "@/components/onboarding/constants";
import { OnboardingContent } from "@/components/onboarding/OnboardingContent";
import type {
	FollowImportResult,
	FollowImportStatus,
	ImportProgressState,
	OnboardingImportResult,
	TabValue,
	TraktImportPreview,
} from "@/components/onboarding/types";
import { useAuth } from "@/contexts/auth";
import { useTheme } from "@/contexts/theme";
import { useToast } from "@/contexts/toast";
import {
	getAvatarUploadErrorMessage,
	validateAvatarAsset,
} from "@/lib/avatar-upload";
import {
	type ImportProgressUpdate,
	parseCsvText,
	runImportInChunks,
} from "@/lib/onboarding-import";

export default function OnboardingScreen() {
	const { user, isLoading: isAuthLoading, isAuthenticated } = useAuth();
	const { colors } = useTheme();
	const { showToast } = useToast();
	const queryClient = useQueryClient();
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
	const [avatarPreviewUri, setAvatarPreviewUri] = useState<string | null>(null);
	const [avatarErrorMessage, setAvatarErrorMessage] = useState<string | null>(
		null,
	);
	const [timezone, setTimezone] = useState("UTC");
	const [timeFormat, setTimeFormat] = useState<"12h" | "24h">("24h");
	const [csvFileName, setCsvFileName] = useState<string | null>(null);

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
			showToast("Could not complete onboarding", "error");
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
			showToast("Could not save profile details", "error");
		},
	});

	const updateSettingsMutation = useMutation({
		mutationKey: ["users", "settings", "update"],
		...usersControllerUpdateMySettingsMutation(),
		onError: () => {
			showToast("Could not save time settings", "error");
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

	const needsAuthRedirect = !isAuthLoading && (!isAuthenticated || !user);
	const needsDashboardRedirect =
		!isAuthLoading && !!user && !user.needsOnboarding;

	useEffect(() => {
		if (needsAuthRedirect) {
			router.replace("/login");
			return;
		}

		if (needsDashboardRedirect) {
			router.replace("/(tabs)");
		}
	}, [needsAuthRedirect, needsDashboardRedirect]);

	useEffect(() => {
		if (!user) {
			return;
		}

		const rawDisplayName = (user as unknown as { displayName?: unknown })
			.displayName;
		setDisplayName(
			typeof rawDisplayName === "string" && rawDisplayName.trim().length > 0
				? rawDisplayName
				: user.handle,
		);
	}, [user]);

	useEffect(() => {
		if (selectedAvatarFile) {
			setAvatarPreviewUri(selectedAvatarFile.uri);
			return;
		}

		setAvatarPreviewUri(user?.avatar ? String(user.avatar) : null);
	}, [selectedAvatarFile, user?.avatar]);

	useEffect(() => {
		if (!settings) {
			return;
		}

		setTimezone(settings.timezone);
		setTimeFormat(settings.timeFormat === "12h" ? "12h" : "24h");
	}, [settings]);

	const hasBlueskyProfile = blueskyProfileStatus?.hasBlueskyProfile === true;
	const visibleStep = hasBlueskyProfile ? step : step >= 4 ? step - 1 : step;
	const totalVisibleSteps = hasBlueskyProfile
		? ONBOARDING_STEPS.length
		: ONBOARDING_STEPS.length - 1;
	const progressPercent = useMemo(
		() => Math.round((visibleStep / totalVisibleSteps) * 100),
		[totalVisibleSteps, visibleStep],
	);

	useEffect(() => {
		if (!hasBlueskyProfile && step === 3) {
			setStep(4);
		}
	}, [hasBlueskyProfile, step]);

	const importPercent =
		importProgress.totalItems > 0
			? Math.round(
					(importProgress.processedItems / importProgress.totalItems) * 100,
				)
			: 0;

	const isImporting =
		fetchTraktMutation.isPending || importHistoryMutation.isPending;
	const isImportBusy = isImporting || importProgress.phase === "parsing_csv";
	const isSavingProfile =
		updateProfileMutation.isPending ||
		updateSettingsMutation.isPending ||
		uploadAvatarMutation.isPending;
	const isCompleting = completeOnboardingMutation.isPending;

	const updateImportProgress = (update: ImportProgressUpdate) => {
		setImportProgress((previous) => ({
			...previous,
			phase: "importing",
			message: "Importing history...",
			...update,
		}));
	};

	const handleSaveProfileAndContinue = async () => {
		try {
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
				setSelectedAvatarFile(null);
				setAvatarErrorMessage(null);
			}

			await updateSettingsMutation.mutateAsync({
				body: {
					timezone,
					timeFormat,
				},
			});

			showToast("Profile and time preferences saved", "success");
			setStep(hasBlueskyProfile ? 3 : 4);
		} catch {
			// surfaced by mutation handlers
		}
	};

	const handlePickAvatar = async () => {
		const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
		if (!permission.granted) {
			showToast("Photo library permission is required", "error");
			return;
		}

		const result = await ImagePicker.launchImageLibraryAsync({
			mediaTypes: "images",
			allowsEditing: true,
			aspect: [1, 1],
			quality: 1,
		});

		const asset = result.assets?.[0];
		if (result.canceled || !asset?.uri) {
			return;
		}

		const validationMessage = validateAvatarAsset(asset);
		if (validationMessage) {
			setAvatarErrorMessage(validationMessage);
			return;
		}

		setAvatarErrorMessage(null);
		setSelectedAvatarFile(new File(asset.uri));
		setAvatarPreviewUri(asset.uri);
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
			showToast(message, "error");
		}
	};

	const completeOnboardingAndRedirect = async () => {
		try {
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

			await Promise.all([
				queryClient.invalidateQueries({
					predicate: (query) => {
						const key = query.queryKey[0] as { _id?: string } | undefined;
						return (
							key?._id === "shelfControllerGetUserShelf" ||
							key?._id === "listsControllerGetUserLists"
						);
					},
				}),
			]);

			if (user?.did) {
				await Promise.all([
					queryClient.prefetchQuery(
						shelfControllerGetUserShelfOptions({
							path: { userDid: user.did },
							query: { page: 1, pageSize: 20 },
						}),
					),
					queryClient.prefetchQuery(listsControllerGetUserListsOptions()),
				]);
			}

			router.replace("/(tabs)");
			void queryClient.invalidateQueries({
				queryKey: authControllerMeOptions().queryKey,
			});
		} catch {
			// surfaced by mutation handlers
		}
	};

	const handleTraktImport = async () => {
		const username = traktUsername.trim();
		if (!username) {
			showToast("Enter your Trakt username", "error");
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
				body: { username },
			});
			setTraktPreview(fetched);

			setImportProgress((previous) => ({
				...previous,
				phase: "preview_ready",
				totalItems: fetched.importableCount,
				message:
					fetched.importableCount > 0
						? `Preview ready for @${fetched.profile.username}`
						: `No importable items found for @${fetched.profile.username}`,
			}));

			if (!fetched.importableCount) {
				showToast("No supported watch history items found", "info");
			}
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: "Unable to fetch Trakt history right now";
			setImportProgress((previous) => ({
				...previous,
				phase: "error",
				message,
			}));
			showToast(message, "error");
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
				updateImportProgress,
			);

			setImportResult({
				imported: result.imported,
				skipped: result.skipped + traktPreview.skipped.length,
				failed: result.failed,
				errors: result.errors,
			});
			setImportProgress((previous) => ({
				...previous,
				phase: "done",
				message: "Import complete.",
			}));
			setStep(5);
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: "Unable to import Trakt history right now";
			setImportProgress((previous) => ({
				...previous,
				phase: "error",
				message,
			}));
			showToast(message, "error");
		}
	};

	const handleCsvImport = async () => {
		try {
			const picked = await DocumentPicker.getDocumentAsync({
				type: [
					"text/csv",
					"text/comma-separated-values",
					"application/vnd.ms-excel",
				],
				copyToCacheDirectory: true,
				multiple: false,
			});

			if (picked.canceled) {
				return;
			}

			const file = picked.assets[0];
			if (!file?.uri) {
				showToast("Could not read selected file", "error");
				return;
			}

			setCsvFileName(file.name ?? "Selected CSV");
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

			const csvText = await new File(file.uri).text();
			const parsed = await parseCsvText(csvText);

			if (!parsed.items.length) {
				setImportResult({
					imported: 0,
					skipped: 0,
					failed: parsed.errors.length,
					errors: parsed.errors.map((entry) => entry.message),
				});
				setImportProgress((previous) => ({
					...previous,
					phase: "error",
					failed: parsed.errors.length,
					message: "No valid rows found in CSV.",
				}));
				showToast("No valid rows found in CSV", "error");
				return;
			}

			const imported = await runImportInChunks(
				parsed.items,
				importHistoryMutation.mutateAsync,
				updateImportProgress,
			);

			setImportResult({
				imported: imported.imported,
				skipped: imported.skipped,
				failed: imported.failed + parsed.errors.length,
				errors: [
					...parsed.errors.map((entry) => entry.message),
					...imported.errors,
				],
			});

			setImportProgress((previous) => ({
				...previous,
				phase: "done",
				failed: imported.failed + parsed.errors.length,
				message: "Import complete.",
			}));

			setStep(5);
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Unable to parse CSV file";
			setImportProgress((previous) => ({
				...previous,
				phase: "error",
				message,
			}));
			showToast(message, "error");
		}
	};

	if (isAuthLoading || isBlueskyProfileStatusLoading) {
		return (
			<View
				style={{
					flex: 1,
					alignItems: "center",
					justifyContent: "center",
					backgroundColor: colors.background,
				}}
			>
				<ActivityIndicator size="large" color={colors.primary} />
			</View>
		);
	}

	if (needsAuthRedirect || needsDashboardRedirect || !user) {
		return null;
	}

	return (
		<OnboardingContent
			step={step}
			progressPercent={progressPercent}
			hasBlueskyProfile={hasBlueskyProfile}
			activeTab={activeTab}
			traktUsername={traktUsername}
			traktPreview={traktPreview}
			displayName={displayName}
			avatarPreviewUri={avatarPreviewUri}
			avatarErrorMessage={avatarErrorMessage}
			timezone={timezone}
			timeFormat={timeFormat}
			csvFileName={csvFileName}
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
					setImportProgress((previous) =>
						previous.phase === "preview_ready"
							? createIdleImportProgress()
							: previous,
					);
				}
			}}
			onTraktUsernameChange={(value) => {
				setTraktUsername(value);
				if (traktPreview) {
					setTraktPreview(null);
					setImportProgress((previous) =>
						previous.phase === "preview_ready"
							? createIdleImportProgress()
							: previous,
					);
				}
			}}
			onDisplayNameChange={setDisplayName}
			onPickAvatar={() => {
				void handlePickAvatar();
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
			onCsvImport={() => {
				void handleCsvImport();
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
