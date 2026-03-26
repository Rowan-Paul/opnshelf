import {
	getTraktImportStatusMessage,
	getTraktImportStatusProgress,
	isActiveTraktImportStatus,
	isKnownTraktImportStatus,
	isTerminalTraktImportStatus,
	usersControllerGetMyCurrentTraktImportOptions,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useEffect, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/auth";
import { useTheme } from "@/contexts/theme";
import {
	dismissTraktImportJob,
	loadDismissedTraktImportJobIds,
} from "@/lib/trakt-import-dismissal";
const MIN_BOTTOM_OFFSET = 12;

type TraktImportStatusBannerProps = {
	bottomOffset?: number;
};

export function TraktImportStatusBanner({
	bottomOffset,
}: TraktImportStatusBannerProps) {
	const { user } = useAuth();
	const { colors } = useTheme();
	const insets = useSafeAreaInsets();
	const [dismissedJobId, setDismissedJobId] = useState<string | null>(null);
	const [dismissedTerminalJobIds, setDismissedTerminalJobIds] = useState<
		string[]
	>([]);
	const [isDismissalReady, setIsDismissalReady] = useState(false);
	const { data: job } = useQuery({
		...usersControllerGetMyCurrentTraktImportOptions(),
		enabled: !!user,
		retry: false,
		staleTime: 0,
		refetchInterval: (query) => {
			const value = query.state.data;
			return value && isActiveTraktImportStatus(value.status) ? 5_000 : false;
		},
	});

	useEffect(() => {
		let isMounted = true;

		const loadDismissedJobIds = async () => {
			if (!user?.did) {
				if (isMounted) {
					setDismissedTerminalJobIds([]);
					setIsDismissalReady(true);
				}
				return;
			}

			setIsDismissalReady(false);
			const dismissedJobIds = await loadDismissedTraktImportJobIds(user.did);
			if (isMounted) {
				setDismissedTerminalJobIds(dismissedJobIds);
				setIsDismissalReady(true);
			}
		};

		void loadDismissedJobIds();

		return () => {
			isMounted = false;
		};
	}, [user?.did]);

	useEffect(() => {
		if (!job) {
			setDismissedJobId(null);
			return;
		}
		if (isActiveTraktImportStatus(job.status)) {
			setDismissedJobId(null);
		}
	}, [job]);

	const statusMessage = job ? getTraktImportStatusMessage(job) : null;
	const progress = job ? getTraktImportStatusProgress(job) : null;
	const isKnownStatus = job ? isKnownTraktImportStatus(job.status) : false;
	const isTerminalJob = job ? isTerminalTraktImportStatus(job.status) : false;
	const isPersistentlyDismissed =
		job && isTerminalJob && dismissedTerminalJobIds.includes(job.id);

	if (
		!user?.did ||
		!job ||
		!isKnownStatus ||
		!statusMessage ||
		dismissedJobId === job.id ||
		isPersistentlyDismissed ||
		(isTerminalJob && !isDismissalReady)
	) {
		return null;
	}

	const handleDismiss = async () => {
		if (isActiveTraktImportStatus(job.status)) {
			setDismissedJobId(job.id);
			return;
		}

		if (!user?.did || !isTerminalTraktImportStatus(job.status)) {
			setDismissedJobId(job.id);
			return;
		}

		const nextDismissedJobIds = await dismissTraktImportJob(user.did, job.id);
		setDismissedTerminalJobIds(nextDismissedJobIds);
	};

	return (
		<View
			pointerEvents="box-none"
			style={[
				styles.container,
				{
					bottom:
						bottomOffset ?? Math.max(insets.bottom, MIN_BOTTOM_OFFSET) + 12,
				},
			]}
		>
			<View
				style={[
					styles.card,
					{
						backgroundColor: colors.surfaceContainerHigh,
						borderColor: colors.outlineVariant,
					},
				]}
			>
				<View style={styles.content}>
					<View style={styles.headerRow}>
						<View style={styles.headerText}>
							<Text style={[styles.kicker, { color: colors.primary }]}>Trakt import</Text>
							<Text style={[styles.title, { color: colors.onSurface }]}>
								{job.profileUsername
									? `@${job.profileUsername}`
									: job.traktUsername}
							</Text>
							<Text
								style={[styles.message, { color: colors.onSurfaceVariant }]}
							>
								{statusMessage}
							</Text>
						</View>
						<Pressable
							onPress={() => void handleDismiss()}
							style={[
								styles.dismissButton,
								{ borderColor: colors.outlineVariant },
							]}
						>
							<Text
								style={[styles.dismissLabel, { color: colors.onSurfaceVariant }]}
							>
								Dismiss
							</Text>
						</Pressable>
					</View>
					{progress !== null ? (
						<View style={styles.progressGroup}>
							<View
								style={[
									styles.progressTrack,
									{ backgroundColor: colors.surfaceContainerHighest },
								]}
							>
								<View
									style={[
										styles.progressFill,
										{
											backgroundColor: colors.primary,
											width: `${progress}%`,
										},
									]}
								/>
							</View>
							<Text
								style={[styles.progressLabel, { color: colors.onSurfaceVariant }]}
							>
								{progress}% complete
							</Text>
						</View>
					) : null}
				</View>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		left: 12,
		position: "absolute",
		right: 12,
		zIndex: 100,
	},
	card: {
		borderRadius: 20,
		borderWidth: 1,
		padding: 14,
		shadowColor: "#000000",
		shadowOffset: { width: 0, height: 10 },
		shadowOpacity: 0.18,
		shadowRadius: 18,
		elevation: 8,
	},
	content: {
		gap: 12,
	},
	headerRow: {
		alignItems: "flex-start",
		flexDirection: "row",
		gap: 12,
		justifyContent: "space-between",
	},
	headerText: {
		flex: 1,
		gap: 2,
	},
	kicker: {
		fontSize: 11,
		fontWeight: "700",
		letterSpacing: 1,
		textTransform: "uppercase",
	},
	title: {
		fontSize: 16,
		fontWeight: "700",
	},
	message: {
		fontSize: 13,
		lineHeight: 18,
	},
	progressGroup: {
		gap: 6,
	},
	progressTrack: {
		borderRadius: 999,
		height: 8,
		overflow: "hidden",
	},
	progressFill: {
		borderRadius: 999,
		height: "100%",
	},
	progressLabel: {
		fontSize: 12,
		fontWeight: "500",
	},
	dismissButton: {
		borderRadius: 999,
		borderWidth: 1,
		paddingHorizontal: 10,
		paddingVertical: 6,
	},
	dismissLabel: {
		fontSize: 12,
		fontWeight: "600",
	},
});
