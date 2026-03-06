import {
	listsControllerGetUserListsOptions,
	moviesControllerDeleteWatchHistoryEntryMutation,
	shelfControllerGetUserShelfOptions,
	showsControllerDeleteEpisodeWatchHistoryEntryMutation,
	showsControllerGetUserUpNextOptions,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { CalendarRange, LayoutDashboard, Search } from "lucide-react-native";
import { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CreateListModal } from "@/components/CreateListModal";
import { RecentWatchedSection } from "@/components/home/RecentWatchedSection";
import { UpNextSection } from "@/components/home/UpNextSection";
import { UserListsSection } from "@/components/home/UserListsSection";
import type { DashboardUser } from "@/components/home/types";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { borderRadius, spacing } from "@/constants/spacing";
import { useTheme } from "@/contexts/theme";
import { useToast } from "@/contexts/toast";
import { useFormattedDate } from "@/hooks/useFormattedDate";
import { useHomeMetrics } from "@/hooks/useHomeMetrics";
import {
	invalidateUserShelfQueries,
	invalidateUserUpNextQueries,
} from "@/lib/invalidate-shelf";

type DashboardHomeProps = {
	user: DashboardUser;
};

export function DashboardHome({ user }: DashboardHomeProps) {
	const { colors } = useTheme();
	const { showToast } = useToast();
	const queryClient = useQueryClient();
	const { formatDate } = useFormattedDate();
	const [range, setRange] = useState<"week" | "month">("week");
	const [showCreateModal, setShowCreateModal] = useState(false);

	const {
		data: shelfData,
		isLoading: isShelfLoading,
		isRefetching: isShelfRefetching,
		refetch: refetchShelf,
	} = useQuery({
		...shelfControllerGetUserShelfOptions({
			path: { userDid: user.did },
			query: { limit: 20 },
		}),
		enabled: !!user.did,
	});

	const {
		data: lists,
		isLoading: isListsLoading,
		isRefetching: isListsRefetching,
		refetch: refetchLists,
	} = useQuery({
		...listsControllerGetUserListsOptions(),
		enabled: !!user.did,
	});

	const {
		data: upNext,
		isLoading: isUpNextLoading,
		isRefetching: isUpNextRefetching,
		refetch: refetchUpNext,
	} = useQuery({
		...showsControllerGetUserUpNextOptions({
			path: { userDid: user.did },
		}),
		enabled: !!user.did,
	});

	const isRefreshing = isShelfRefetching || isListsRefetching || isUpNextRefetching;

	const handleRefresh = useCallback(async () => {
		await Promise.all([refetchShelf(), refetchLists(), refetchUpNext()]);
	}, [refetchShelf, refetchLists, refetchUpNext]);

	const {
		watchedInRangeCount,
		recentWatched,
		activityBars,
		recentLists,
	} = useHomeMetrics(
		shelfData?.items,
		shelfData?.total,
		lists,
		range,
	);

	const displayName = resolveDisplayName(user);
	const maxActivityValue = Math.max(...activityBars.map((bar) => bar.value), 1);

	const deleteMovieMutation = useMutation({
		mutationKey: ["dashboard", "movies", "delete"],
		...moviesControllerDeleteWatchHistoryEntryMutation(),
		onSuccess: () => {
			invalidateUserShelfQueries(queryClient, user.did);
			showToast("Removed from your shelf", "success");
		},
		onError: () => {
			showToast("Failed to remove. Please try again.", "error");
		},
	});

	const deleteEpisodeMutation = useMutation({
		mutationKey: ["dashboard", "episodes", "delete"],
		...showsControllerDeleteEpisodeWatchHistoryEntryMutation(),
		onSuccess: () => {
			invalidateUserShelfQueries(queryClient, user.did);
			invalidateUserUpNextQueries(queryClient, user.did);
			showToast("Episode removed from history", "success");
		},
		onError: () => {
			showToast("Failed to remove episode. Please try again.", "error");
		},
	});

	const handleRemoveMovie = useCallback(
		(trackedMovieId: string) => {
			deleteMovieMutation.mutate({ path: { trackedMovieId } });
		},
		[deleteMovieMutation],
	);

	const handleRemoveEpisode = useCallback(
		(trackedEpisodeId: string) => {
			deleteEpisodeMutation.mutate({ path: { trackedEpisodeId } });
		},
		[deleteEpisodeMutation],
	);

	return (
		<SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
			<ScrollView
				contentContainerStyle={styles.scrollContent}
				refreshControl={
					<RefreshControl
						refreshing={isRefreshing}
						onRefresh={handleRefresh}
						tintColor={colors.primary}
						colors={[colors.primary]}
						progressBackgroundColor={colors.surfaceContainerHigh}
					/>
				}
			>
				<View
					style={[
						styles.dashboardHeader,
						{
							backgroundColor: colors.surfaceContainerHigh,
							borderColor: colors.outlineVariant,
						},
					]}
				>
					<View style={styles.dashboardTitleWrap}>
						<View style={[styles.dashboardIconBadge, { backgroundColor: colors.primaryContainer }]}>
							<LayoutDashboard size={24} color={colors.primary} />
						</View>
						<View style={styles.dashboardHeadingCopy}>
							<Text style={[styles.dashboardTitle, { color: colors.onBackground }]}>Dashboard</Text>
							<Text style={[styles.greeting, { color: colors.onSurfaceVariant }]}>Welcome back, {displayName}</Text>
						</View>
					</View>
					<Button size="lg" onPress={() => router.push("/(tabs)/search")} style={styles.dashboardSearchButton}>
						<Search size={20} color={colors.onPrimary} style={styles.buttonIcon} />
						<Text style={[styles.buttonText, { color: colors.onPrimary }]}>Search</Text>
					</Button>
				</View>

				<UpNextSection
					isLoading={isUpNextLoading}
					items={upNext ?? []}
					userDid={user.did}
				/>

				<Card
					style={{
						...styles.metricsCard,
						backgroundColor: colors.surfaceContainerHigh,
						borderColor: colors.outlineVariant,
					}}
				>
					<CardHeader>
						<View style={styles.metricsHeaderRow}>
							<View>
								<Text style={[styles.metricsTitle, { color: colors.onSurface }]}>At a glance</Text>
								<Text style={[styles.metricsSubtitle, { color: colors.onSurfaceVariant }]}>A lighter read on your recent momentum.</Text>
							</View>
							<View style={styles.rangeToggle}>
								{(["week", "month"] as const).map((tab) => (
									<Pressable
										key={tab}
										onPress={() => setRange(tab)}
									style={[
										styles.rangePill,
										{
											backgroundColor:
												range === tab ? colors.primaryContainer : colors.surfaceContainer,
											borderColor:
												range === tab ? colors.primaryContainer : colors.outlineVariant,
										},
									]}
								>
										<Text
											style={[
												styles.rangePillText,
												{ color: range === tab ? colors.onPrimaryContainer : colors.onSurfaceVariant },
											]}
										>
											{tab === "week" ? "Week" : "Month"}
										</Text>
									</Pressable>
								))}
							</View>
						</View>
					</CardHeader>
					<CardContent>
						<View
							style={[
								styles.activityCard,
								{ backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant },
							]}
						>
							<View style={styles.activityHeaderRow}>
								<Text style={[styles.activityTitle, { color: colors.onSurface }]}>Viewing rhythm</Text>
								<Text style={[styles.activitySubtitle, { color: colors.onSurfaceVariant }]}> 
									{range === "week" ? "Last 7 days" : "Weekly activity"}
								</Text>
							</View>
							<View style={styles.activityBarsRow}>
								{activityBars.map((bar) => (
									<View key={bar.label} style={styles.activityBarItem}>
										<View style={styles.activityBarTrack}>
											<View
												style={[
													styles.activityBarFill,
													{
														backgroundColor: colors.primary,
														height: `${Math.max((bar.value / maxActivityValue) * 100, bar.value > 0 ? 18 : 8)}%`,
													},
												]}
											/>
										</View>
										<Text style={[styles.activityValue, { color: colors.onSurface }]}>{bar.value}</Text>
										<Text style={[styles.activityLabel, { color: colors.onSurfaceVariant }]}>{bar.label}</Text>
									</View>
								))}
							</View>
						</View>
						<View style={styles.metricsGrid}>
							<View
								style={[
									styles.metricTile,
									{ backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant },
								]}
							>
								<View style={styles.metricTitleRow}>
									<CalendarRange size={16} color={colors.primary} />
									<Text style={[styles.metricTitle, { color: colors.onSurface }]}>Watched {range === "week" ? "7d" : "30d"}</Text>
								</View>
								<Text style={[styles.metricValue, { color: colors.onSurface }]}>{watchedInRangeCount}</Text>
							</View>
						</View>
					</CardContent>
				</Card>

				<RecentWatchedSection
					isLoading={isShelfLoading}
					recentWatched={recentWatched}
					formatDate={formatDate}
					onRemoveMovie={handleRemoveMovie}
					onRemoveEpisode={handleRemoveEpisode}
					deletingMovieId={deleteMovieMutation.variables?.path?.trackedMovieId}
					deletingEpisodeId={deleteEpisodeMutation.variables?.path?.trackedEpisodeId}
				/>

				<UserListsSection
					isLoading={isListsLoading}
					recentLists={recentLists}
					onCreateList={() => setShowCreateModal(true)}
				/>
			</ScrollView>

			<CreateListModal visible={showCreateModal} onClose={() => setShowCreateModal(false)} />
		</SafeAreaView>
	);
}

function resolveDisplayName(user: DashboardUser): string {
	const rawDisplayName = (user as unknown as { displayName?: unknown }).displayName;
	if (typeof rawDisplayName === "string" && rawDisplayName.trim().length > 0) {
		return rawDisplayName;
	}

	return user.handle;
}

const styles = StyleSheet.create({
	container: { flex: 1 },
	scrollContent: { padding: spacing.lg, paddingBottom: spacing.xxl },
	dashboardHeader: {
		marginBottom: spacing.lg,
		padding: spacing.md,
		borderRadius: borderRadius.xl,
		borderWidth: 1,
		gap: spacing.md,
	},
	dashboardTitleWrap: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
	dashboardIconBadge: {
		width: 48,
		height: 48,
		borderRadius: borderRadius.full,
		alignItems: "center",
		justifyContent: "center",
	},
	dashboardHeadingCopy: { flex: 1, gap: spacing.xs },
	dashboardTitle: { fontSize: 30, fontWeight: "700" },
	greeting: { fontSize: 15, lineHeight: 21 },
	dashboardSearchButton: { width: "100%", borderRadius: borderRadius.full },
	buttonIcon: { marginRight: spacing.sm },
	buttonText: { fontSize: 16, fontWeight: "600" },
	metricsCard: {
		marginBottom: spacing.lg,
		borderRadius: borderRadius.lg,
		borderWidth: 1,
	},
	metricsHeaderRow: {
		gap: spacing.sm,
	},
	metricsTitle: {
		fontSize: 18,
		fontWeight: "700",
	},
	metricsSubtitle: {
		fontSize: 13,
		lineHeight: 18,
		marginTop: spacing.xs,
	},
	metricsGrid: {
		gap: spacing.sm,
	},
	activityCard: {
		borderRadius: borderRadius.lg,
		borderWidth: 1,
		padding: spacing.md,
		marginBottom: spacing.sm,
	},
	activityHeaderRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: spacing.md,
		gap: spacing.sm,
	},
	activityTitle: { fontSize: 14, fontWeight: "700" },
	activitySubtitle: { fontSize: 12 },
	activityBarsRow: {
		flexDirection: "row",
		alignItems: "flex-end",
		justifyContent: "space-between",
		gap: spacing.xs,
		minHeight: 132,
	},
	activityBarItem: {
		flex: 1,
		alignItems: "center",
		gap: spacing.xs,
	},
	activityBarTrack: {
		height: 84,
		width: "100%",
		borderRadius: borderRadius.md,
		justifyContent: "flex-end",
		overflow: "hidden",
		backgroundColor: "rgba(127,127,127,0.14)",
	},
	activityBarFill: {
		width: "100%",
		borderRadius: borderRadius.md,
		minHeight: 0,
	},
	activityValue: { fontSize: 12, fontWeight: "700" },
	activityLabel: { fontSize: 11 },
	metricTile: {
		borderRadius: borderRadius.lg,
		borderWidth: 1,
		padding: spacing.md,
	},
	metricTitleRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
	metricTitle: { fontSize: 14, fontWeight: "600" },
	metricValue: { fontSize: 26, fontWeight: "700", marginTop: spacing.sm },
	metricCaption: { fontSize: 12, marginTop: spacing.xs },
	rangeToggle: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm, flexWrap: "wrap" },
	rangePill: {
		paddingHorizontal: spacing.sm,
		paddingVertical: 6,
		borderRadius: borderRadius.full,
		borderWidth: 1,
	},
	rangePillText: { fontSize: 12, fontWeight: "600" },
});
