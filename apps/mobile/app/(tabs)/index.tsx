import {
	listsControllerGetUserListsOptions,
	shelfControllerGetUserShelfOptions,
	type UserDto,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router } from "expo-router";
import {
	CalendarRange,
	Film,
	LayoutDashboard,
	ListChecks,
	ListPlus,
	Search,
	Share2,
	Shield,
} from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CreateListModal } from "@/components/CreateListModal";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { borderRadius, spacing } from "@/constants/spacing";
import { useAuth } from "@/contexts/auth";
import { useTheme } from "@/contexts/theme";
import { useFormattedDate } from "@/hooks/useFormattedDate";
import { createTitleSlug, getTmdbPosterUrl } from "@/lib/utils";

const features = [
	{
		icon: Film,
		title: "Track Your Media",
		description:
			"Keep track of movies, shows, and games you've watched and played",
	},
	{
		icon: Shield,
		title: "Own Your Data",
		description: "Built on AT Protocol - your data belongs to you",
	},
	{
		icon: Share2,
		title: "Discover & Share",
		description: "See what others are watching and share your favorites",
	},
];

export default function HomeScreen() {
	const { user, isLoading: isAuthLoading, isAuthenticated } = useAuth();
	const { colors } = useTheme();
	const { formatDate } = useFormattedDate();
	const [range, setRange] = useState<"week" | "month">("week");
	const [showCreateModal, setShowCreateModal] = useState(false);

	const { data: shelfData, isLoading: isShelfLoading } = useQuery({
		...shelfControllerGetUserShelfOptions({
			path: { userDid: user?.did || "" },
			query: { limit: 20 },
		}),
		enabled: !!user?.did && isAuthenticated,
	});

	const { data: lists, isLoading: isListsLoading } = useQuery({
		...listsControllerGetUserListsOptions(),
		enabled: !!user?.did && isAuthenticated,
	});

	const { watchedInRangeCount, totalTracked, recentWatched } = useMemo(() => {
		const now = Date.now();
		const days = range === "week" ? 7 : 30;
		const cutoff = now - days * 24 * 60 * 60 * 1000;

		const items = shelfData?.items ?? [];

		const sorted = items.sort((a, b) => {
			const dateA = a.watchedDate
				? new Date(a.watchedDate).getTime()
				: new Date(a.createdAt).getTime();
			const dateB = b.watchedDate
				? new Date(b.watchedDate).getTime()
				: new Date(b.createdAt).getTime();
			return dateB - dateA;
		});

		const inRange = sorted.filter((item) => {
			const date = item.watchedDate
				? new Date(item.watchedDate).getTime()
				: new Date(item.createdAt).getTime();
			return date >= cutoff;
		});

		return {
			watchedInRangeCount: inRange.length,
			totalTracked: shelfData?.total ?? 0,
			recentWatched: sorted.slice(0, 5),
		};
	}, [shelfData, range]);

	const { listCount, totalMoviesInLists, recentLists } = useMemo(() => {
		const items = lists ?? [];
		const sorted = [...items].sort((a, b) => {
			return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
		});

		return {
			listCount: items.length,
			totalMoviesInLists: items.reduce((acc, list) => acc + list.movieCount, 0),
			recentLists: sorted.slice(0, 4),
		};
	}, [lists]);

	if (isAuthLoading) {
		return (
			<SafeAreaView
				style={[styles.container, { backgroundColor: colors.background }]}
				edges={["top"]}
			>
				<View style={styles.loadingContainer}>
					<Skeleton
						width="100%"
						height={108}
						style={{ marginBottom: spacing.md }}
					/>
					<Skeleton
						width="100%"
						height={108}
						style={{ marginBottom: spacing.md }}
					/>
					<Skeleton width="100%" height={160} />
				</View>
			</SafeAreaView>
		);
	}

	if (!isAuthenticated || !user) {
		return <UnauthenticatedHome />;
	}

	return (
		<SafeAreaView
			style={[styles.container, { backgroundColor: colors.background }]}
			edges={["top"]}
		>
			<ScrollView contentContainerStyle={styles.scrollContent}>
				<View style={styles.dashboardHeader}>
					<View style={styles.dashboardTitleWrap}>
						<LayoutDashboard size={28} color={colors.primary} />
						<Text
							style={[styles.dashboardTitle, { color: colors.onBackground }]}
						>
							Dashboard
						</Text>
					</View>
					<Text style={[styles.greeting, { color: colors.onSurfaceVariant }]}>
						Welcome back, {resolveDisplayName(user)}
					</Text>
					<Button
						size="lg"
						onPress={() => router.push("/(tabs)/search")}
						style={styles.dashboardSearchButton}
					>
						<Search
							size={20}
							color={colors.onPrimary}
							style={styles.buttonIcon}
						/>
						<Text style={[styles.buttonText, { color: colors.onPrimary }]}>
							Search
						</Text>
					</Button>
				</View>

				<View style={styles.metricsGrid}>
					<Card
						style={{
							borderRadius: borderRadius.lg,
							borderWidth: 1,
							backgroundColor: colors.surfaceContainerHigh,
							borderColor: colors.outlineVariant,
						}}
					>
						<CardHeader>
							<View style={styles.metricTitleRow}>
								<CalendarRange size={18} color={colors.primary} />
								<Text style={[styles.metricTitle, { color: colors.onSurface }]}>
									Watched ({range === "week" ? "7d" : "30d"})
								</Text>
							</View>
						</CardHeader>
						<CardContent>
							<Text style={[styles.metricValue, { color: colors.onSurface }]}>
								{watchedInRangeCount}
							</Text>
							<View style={styles.rangeToggle}>
								<Pressable
									onPress={() => setRange("week")}
									style={[
										styles.rangePill,
										{
											backgroundColor:
												range === "week"
													? colors.primaryContainer
													: colors.surfaceContainerHigh,
										},
									]}
								>
									<Text
										style={[
											styles.rangePillText,
											{
												color:
													range === "week"
														? colors.onPrimaryContainer
														: colors.onSurfaceVariant,
											},
										]}
									>
										Week
									</Text>
								</Pressable>
								<Pressable
									onPress={() => setRange("month")}
									style={[
										styles.rangePill,
										{
											backgroundColor:
												range === "month"
													? colors.primaryContainer
													: colors.surfaceContainerHigh,
										},
									]}
								>
									<Text
										style={[
											styles.rangePillText,
											{
												color:
													range === "month"
														? colors.onPrimaryContainer
														: colors.onSurfaceVariant,
											},
										]}
									>
										Month
									</Text>
								</Pressable>
							</View>
						</CardContent>
					</Card>

					<Card
						style={{
							borderRadius: borderRadius.lg,
							borderWidth: 1,
							backgroundColor: colors.surfaceContainerHigh,
							borderColor: colors.outlineVariant,
						}}
					>
						<CardHeader>
							<View style={styles.metricTitleRow}>
								<Film size={18} color={colors.primary} />
								<Text style={[styles.metricTitle, { color: colors.onSurface }]}>
									Total on Shelf
								</Text>
							</View>
						</CardHeader>
						<CardContent>
							<Text style={[styles.metricValue, { color: colors.onSurface }]}>
								{totalTracked}
							</Text>
						</CardContent>
					</Card>

					<Card
						style={{
							borderRadius: borderRadius.lg,
							borderWidth: 1,
							backgroundColor: colors.surfaceContainerHigh,
							borderColor: colors.outlineVariant,
						}}
					>
						<CardHeader>
							<View style={styles.metricTitleRow}>
								<ListChecks size={18} color={colors.primary} />
								<Text style={[styles.metricTitle, { color: colors.onSurface }]}>
									Your Lists
								</Text>
							</View>
						</CardHeader>
						<CardContent>
							<Text style={[styles.metricValue, { color: colors.onSurface }]}>
								{listCount}
							</Text>
							<Text
								style={[
									styles.metricCaption,
									{ color: colors.onSurfaceVariant },
								]}
							>
								{totalMoviesInLists} items across lists
							</Text>
						</CardContent>
					</Card>
				</View>

				<View style={styles.section}>
					<View style={styles.sectionHeader}>
						<Text style={[styles.sectionTitle, { color: colors.onBackground }]}>
							Recent Watched
						</Text>
						<Pressable onPress={() => router.push("/(tabs)/profile/shelf")}>
							<Text style={[styles.sectionLink, { color: colors.primary }]}>
								View shelf
							</Text>
						</Pressable>
					</View>
					{isShelfLoading ? (
						<View style={styles.sectionSkeleton}>
							{[1, 2, 3].map((i) => (
								<Skeleton
									key={i}
									width="100%"
									height={100}
									style={{ marginBottom: spacing.sm }}
								/>
							))}
						</View>
					) : recentWatched.length > 0 ? (
						<View style={styles.recentList}>
							{recentWatched.map((tracked) => {
								const watchDate = tracked.watchedDate ?? tracked.createdAt;
								const formattedDate = formatDate(watchDate, {
									includeTime: false,
								});
								const posterUrl = getTmdbPosterUrl(tracked.posterPath);

								const isEpisode = tracked.type === "episode";

								return (
									<Pressable
										key={tracked.id}
										onPress={() =>
											isEpisode
												? router.push({
														pathname:
															"/show/[id]/season/[seasonNumber]/episode/[episodeNumber]",
														params: {
															id: tracked.showId,
															seasonNumber: (
																tracked as unknown as { seasonNumber: number }
															).seasonNumber.toString(),
															episodeNumber: (
																tracked as unknown as { episodeNumber: number }
															).episodeNumber.toString(),
														},
													})
												: router.push({
														pathname: "/movie/[id]",
														params: {
															id: tracked.movieId,
															title: createTitleSlug(
																(tracked as unknown as { title: string }).title,
															),
														},
													})
										}
										style={[
											styles.recentItem,
											{
												backgroundColor: colors.surfaceContainer,
												borderColor: colors.outline,
											},
										]}
									>
										<View
											style={[
												styles.recentPoster,
												{ backgroundColor: colors.surfaceContainerHigh },
											]}
										>
											{posterUrl ? (
												<Image
													source={{ uri: posterUrl }}
													style={styles.recentPosterImage}
													contentFit="cover"
													transition={150}
												/>
											) : (
												<Text
													style={[
														styles.recentPosterFallback,
														{ color: colors.onSurfaceVariant },
													]}
												>
													No poster
												</Text>
											)}
										</View>
										<View style={styles.recentMeta}>
											<Text
												style={[
													styles.recentTitle,
													{ color: colors.onSurface },
												]}
												numberOfLines={2}
											>
												{isEpisode
													? (tracked as unknown as { showTitle: string })
															.showTitle
													: (tracked as unknown as { title: string }).title}
											</Text>
											<Text
												style={[
													styles.recentDate,
													{ color: colors.onSurfaceVariant },
												]}
											>
												{isEpisode
													? `S${(tracked as unknown as { seasonNumber: number }).seasonNumber} E${(tracked as unknown as { episodeNumber: number }).episodeNumber} • `
													: ""}
												Watched {formattedDate}
											</Text>
										</View>
									</Pressable>
								);
							})}
						</View>
					) : (
						<Card>
							<CardHeader>
								<Text style={[styles.emptyTitle, { color: colors.onSurface }]}>
									No items watched yet
								</Text>
							</CardHeader>
							<CardContent>
								<Text
									style={[
										styles.emptyDescription,
										{ color: colors.onSurfaceVariant },
									]}
								>
									Start adding watched items and your activity appears here.
								</Text>
								<Button
									onPress={() => router.push("/(tabs)/search")}
									style={styles.emptyButton}
								>
									<Text
										style={[styles.buttonText, { color: colors.onPrimary }]}
									>
										Search
									</Text>
								</Button>
							</CardContent>
						</Card>
					)}
				</View>

				<View style={styles.section}>
					<View style={styles.sectionHeader}>
						<Text style={[styles.sectionTitle, { color: colors.onBackground }]}>
							Your Lists
						</Text>
						<Pressable onPress={() => router.push("/(tabs)/profile/lists")}>
							<Text style={[styles.sectionLink, { color: colors.primary }]}>
								All lists
							</Text>
						</Pressable>
					</View>
					<Button
						variant="outlined"
						onPress={() => setShowCreateModal(true)}
						style={styles.createListButton}
					>
						<ListPlus
							size={16}
							color={colors.primary}
							style={styles.buttonIcon}
						/>
						<Text style={[styles.createListText, { color: colors.primary }]}>
							Create list
						</Text>
					</Button>
					{isListsLoading ? (
						<View style={styles.sectionSkeleton}>
							{[1, 2].map((i) => (
								<Skeleton
									key={i}
									width="100%"
									height={96}
									style={{ marginBottom: spacing.sm }}
								/>
							))}
						</View>
					) : recentLists.length > 0 ? (
						<View style={styles.recentList}>
							{recentLists.map((list) => (
								<Pressable
									key={list.id}
									onPress={() => router.push(`/list/${list.slug}`)}
									style={[
										styles.listItem,
										{
											backgroundColor: colors.surfaceContainer,
											borderColor: colors.outline,
										},
									]}
								>
									<View style={styles.listMeta}>
										<Text
											style={[styles.listName, { color: colors.onSurface }]}
											numberOfLines={1}
										>
											{list.name}
										</Text>
										<Text
											style={[
												styles.listCount,
												{ color: colors.onSurfaceVariant },
											]}
										>
											{list.movieCount} item{list.movieCount !== 1 ? "s" : ""}
										</Text>
									</View>
								</Pressable>
							))}
						</View>
					) : (
						<Card>
							<CardHeader>
								<Text style={[styles.emptyTitle, { color: colors.onSurface }]}>
									No lists yet
								</Text>
							</CardHeader>
							<CardContent>
								<Text
									style={[
										styles.emptyDescription,
										{ color: colors.onSurfaceVariant },
									]}
								>
									Create your first list to organize items.
								</Text>
							</CardContent>
						</Card>
					)}
				</View>
			</ScrollView>
			<CreateListModal
				visible={showCreateModal}
				onClose={() => setShowCreateModal(false)}
			/>
		</SafeAreaView>
	);
}

function UnauthenticatedHome() {
	const { colors } = useTheme();

	return (
		<SafeAreaView
			style={[styles.container, { backgroundColor: colors.background }]}
			edges={["top"]}
		>
			<ScrollView contentContainerStyle={styles.scrollContent}>
				<View style={styles.hero}>
					<View style={styles.logoContainer}>
						<Image
							source={require("@/assets/images/icon.png")}
							style={styles.logo}
						/>
					</View>
					<Text style={[styles.title, { color: colors.onBackground }]}>
						OpnShelf
					</Text>
					<Text style={[styles.subtitle, { color: colors.onSurfaceVariant }]}>
						Your personal media tracker powered by AT Protocol
					</Text>
					<Button
						size="lg"
						onPress={() => router.push("/(tabs)/search")}
						style={styles.searchButton}
					>
						<Search
							size={20}
							color={colors.onPrimary}
							style={styles.buttonIcon}
						/>
						<Text style={[styles.buttonText, { color: colors.onPrimary }]}>
							Search
						</Text>
					</Button>
				</View>

				<View style={styles.features}>
					{features.map((feature, index) => (
						<Card key={index} style={styles.featureCard}>
							<CardHeader>
								<feature.icon
									size={32}
									color={colors.primary}
									style={styles.featureIcon}
								/>
								<Text
									style={[styles.featureTitle, { color: colors.onSurface }]}
								>
									{feature.title}
								</Text>
							</CardHeader>
							<CardContent>
								<Text
									style={[
										styles.featureDescription,
										{ color: colors.onSurfaceVariant },
									]}
								>
									{feature.description}
								</Text>
							</CardContent>
						</Card>
					))}
				</View>
			</ScrollView>
		</SafeAreaView>
	);
}

function resolveDisplayName(user: UserDto): string {
	const rawDisplayName = (user as unknown as { displayName?: unknown })
		.displayName;
	if (typeof rawDisplayName === "string" && rawDisplayName.trim().length > 0) {
		return rawDisplayName;
	}

	return user.handle;
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	scrollContent: {
		padding: spacing.lg,
	},
	loadingContainer: {
		padding: spacing.lg,
	},
	hero: {
		alignItems: "center",
		paddingVertical: spacing.xxl,
	},
	logoContainer: {
		marginBottom: spacing.lg,
	},
	logo: {
		width: 100,
		height: 100,
		borderRadius: 20,
	},
	title: {
		fontSize: 40,
		fontWeight: "bold",
		marginBottom: spacing.sm,
	},
	subtitle: {
		fontSize: 16,
		textAlign: "center",
		marginBottom: spacing.xl,
		paddingHorizontal: spacing.lg,
	},
	searchButton: {
		minWidth: 200,
	},
	buttonIcon: {
		marginRight: spacing.sm,
	},
	buttonText: {
		fontSize: 16,
		fontWeight: "600",
	},
	features: {
		gap: spacing.md,
	},
	dashboardHeader: {
		marginBottom: spacing.lg,
	},
	dashboardTitleWrap: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.sm,
		marginBottom: spacing.xs,
	},
	dashboardTitle: {
		fontSize: 32,
		fontWeight: "700",
	},
	greeting: {
		fontSize: 15,
		marginBottom: spacing.md,
	},
	dashboardSearchButton: {
		alignSelf: "flex-start",
	},
	metricsGrid: {
		gap: spacing.sm,
		marginBottom: spacing.lg,
	},
	metricTitleRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.xs,
	},
	metricTitle: {
		fontSize: 14,
		fontWeight: "600",
	},
	metricValue: {
		fontSize: 30,
		fontWeight: "700",
	},
	metricCaption: {
		fontSize: 12,
		marginTop: spacing.xs,
	},
	rangeToggle: {
		flexDirection: "row",
		gap: spacing.sm,
		marginTop: spacing.sm,
	},
	rangePill: {
		paddingHorizontal: spacing.sm,
		paddingVertical: 6,
		borderRadius: borderRadius.full,
	},
	rangePillText: {
		fontSize: 12,
		fontWeight: "600",
	},
	section: {
		marginBottom: spacing.xl,
	},
	sectionHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: spacing.sm,
	},
	sectionTitle: {
		fontSize: 22,
		fontWeight: "700",
	},
	sectionLink: {
		fontSize: 14,
		fontWeight: "600",
	},
	sectionSkeleton: {
		marginTop: spacing.sm,
	},
	recentList: {
		gap: spacing.sm,
	},
	recentItem: {
		flexDirection: "row",
		borderRadius: borderRadius.lg,
		borderWidth: 1,
		overflow: "hidden",
	},
	recentPoster: {
		width: 68,
		height: 100,
		alignItems: "center",
		justifyContent: "center",
	},
	recentPosterImage: {
		width: "100%",
		height: "100%",
	},
	recentPosterFallback: {
		fontSize: 10,
		fontWeight: "600",
	},
	recentMeta: {
		flex: 1,
		paddingVertical: spacing.sm,
		paddingHorizontal: spacing.md,
		justifyContent: "center",
	},
	recentTitle: {
		fontSize: 15,
		fontWeight: "600",
		marginBottom: spacing.xs,
	},
	recentDate: {
		fontSize: 12,
	},
	emptyTitle: {
		fontSize: 18,
		fontWeight: "700",
	},
	emptyDescription: {
		fontSize: 14,
		lineHeight: 20,
	},
	emptyButton: {
		marginTop: spacing.md,
		alignSelf: "flex-start",
	},
	createListButton: {
		alignSelf: "flex-start",
		marginBottom: spacing.sm,
	},
	createListText: {
		fontSize: 14,
		fontWeight: "600",
	},
	listItem: {
		borderWidth: 1,
		borderRadius: borderRadius.lg,
		padding: spacing.md,
	},
	listMeta: {
		gap: spacing.xs,
	},
	listName: {
		fontSize: 16,
		fontWeight: "600",
	},
	listCount: {
		fontSize: 13,
	},
	featureCard: {
		marginBottom: spacing.md,
	},
	featureIcon: {
		marginBottom: spacing.sm,
	},
	featureTitle: {
		fontSize: 18,
		fontWeight: "600",
	},
	featureDescription: {
		fontSize: 14,
		lineHeight: 20,
	},
});
