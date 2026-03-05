import {
	listsControllerGetUserListsOptions,
	shelfControllerGetUserShelfOptions,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { CalendarRange, Film, LayoutDashboard, ListChecks, Search } from "lucide-react-native";
import { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CreateListModal } from "@/components/CreateListModal";
import { RecentWatchedSection } from "@/components/home/RecentWatchedSection";
import { UserListsSection } from "@/components/home/UserListsSection";
import type { DashboardUser } from "@/components/home/types";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { borderRadius, spacing } from "@/constants/spacing";
import { useTheme } from "@/contexts/theme";
import { useFormattedDate } from "@/hooks/useFormattedDate";
import { useHomeMetrics } from "@/hooks/useHomeMetrics";

type DashboardHomeProps = {
	user: DashboardUser;
};

export function DashboardHome({ user }: DashboardHomeProps) {
	const { colors } = useTheme();
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

	const isRefreshing = isShelfRefetching || isListsRefetching;

	const handleRefresh = useCallback(async () => {
		await Promise.all([refetchShelf(), refetchLists()]);
	}, [refetchShelf, refetchLists]);

	const {
		watchedInRangeCount,
		totalTracked,
		recentWatched,
		listCount,
		totalMoviesInLists,
		recentLists,
	} = useHomeMetrics(
		shelfData?.items,
		shelfData?.total,
		lists,
		range,
	);

	const displayName = resolveDisplayName(user);

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
				<View style={styles.dashboardHeader}>
					<View style={styles.dashboardTitleWrap}>
						<LayoutDashboard size={28} color={colors.primary} />
						<Text style={[styles.dashboardTitle, { color: colors.onBackground }]}>Dashboard</Text>
					</View>
					<Text style={[styles.greeting, { color: colors.onSurfaceVariant }]}>Welcome back, {displayName}</Text>
					<Button size="lg" onPress={() => router.push("/(tabs)/search")} style={styles.dashboardSearchButton}>
						<Search size={20} color={colors.onPrimary} style={styles.buttonIcon} />
						<Text style={[styles.buttonText, { color: colors.onPrimary }]}>Search</Text>
					</Button>
				</View>

				<View style={styles.metricsGrid}>
					<Card
						style={{
							...styles.metricCard,
							backgroundColor: colors.surfaceContainerHigh,
							borderColor: colors.outlineVariant,
						}}
					>
						<CardHeader>
							<View style={styles.metricTitleRow}>
								<CalendarRange size={18} color={colors.primary} />
								<Text style={[styles.metricTitle, { color: colors.onSurface }]}>Watched ({range === "week" ? "7d" : "30d"})</Text>
							</View>
						</CardHeader>
						<CardContent>
							<Text style={[styles.metricValue, { color: colors.onSurface }]}>{watchedInRangeCount}</Text>
							<View style={styles.rangeToggle}>
								{(["week", "month"] as const).map((tab) => (
									<Pressable
										key={tab}
										onPress={() => setRange(tab)}
										style={[
											styles.rangePill,
											{
												backgroundColor:
													range === tab ? colors.primaryContainer : colors.surfaceContainerHigh,
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
						</CardContent>
					</Card>

					<Card
						style={{
							...styles.metricCard,
							backgroundColor: colors.surfaceContainerHigh,
							borderColor: colors.outlineVariant,
						}}
					>
						<CardHeader>
							<View style={styles.metricTitleRow}>
								<Film size={18} color={colors.primary} />
								<Text style={[styles.metricTitle, { color: colors.onSurface }]}>Total on Shelf</Text>
							</View>
						</CardHeader>
						<CardContent>
							<Text style={[styles.metricValue, { color: colors.onSurface }]}>{totalTracked}</Text>
						</CardContent>
					</Card>

					<Card
						style={{
							...styles.metricCard,
							backgroundColor: colors.surfaceContainerHigh,
							borderColor: colors.outlineVariant,
						}}
					>
						<CardHeader>
							<View style={styles.metricTitleRow}>
								<ListChecks size={18} color={colors.primary} />
								<Text style={[styles.metricTitle, { color: colors.onSurface }]}>Your Lists</Text>
							</View>
						</CardHeader>
						<CardContent>
							<Text style={[styles.metricValue, { color: colors.onSurface }]}>{listCount}</Text>
							<Text style={[styles.metricCaption, { color: colors.onSurfaceVariant }]}> 
								{totalMoviesInLists} items across lists
							</Text>
						</CardContent>
					</Card>
				</View>

				<RecentWatchedSection
					isLoading={isShelfLoading}
					recentWatched={recentWatched}
					formatDate={formatDate}
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
	scrollContent: { padding: spacing.lg },
	dashboardHeader: { marginBottom: spacing.lg },
	dashboardTitleWrap: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.xs },
	dashboardTitle: { fontSize: 32, fontWeight: "700" },
	greeting: { fontSize: 15, marginBottom: spacing.md },
	dashboardSearchButton: { alignSelf: "flex-start" },
	buttonIcon: { marginRight: spacing.sm },
	buttonText: { fontSize: 16, fontWeight: "600" },
	metricsGrid: { gap: spacing.sm, marginBottom: spacing.lg },
	metricCard: {
		borderRadius: borderRadius.lg,
		borderWidth: 1,
	},
	metricTitleRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
	metricTitle: { fontSize: 14, fontWeight: "600" },
	metricValue: { fontSize: 30, fontWeight: "700" },
	metricCaption: { fontSize: 12, marginTop: spacing.xs },
	rangeToggle: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
	rangePill: {
		paddingHorizontal: spacing.sm,
		paddingVertical: 6,
		borderRadius: borderRadius.full,
	},
	rangePillText: { fontSize: 12, fontWeight: "600" },
});
