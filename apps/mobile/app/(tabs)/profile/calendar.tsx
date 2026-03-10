import {
	type ReleaseCalendarItemDto,
	showsControllerGetUserReleaseCalendarOptions,
} from "@opnshelf/api";
import { FlashList } from "@shopify/flash-list";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router } from "expo-router";
import {
	ArrowLeft,
	Calendar,
	ChevronLeft,
	ChevronRight,
	Clapperboard,
	LogIn,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
	Pressable,
	RefreshControl,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { borderRadius, spacing } from "@/constants/spacing";
import { useAuth } from "@/contexts/auth";
import { useTheme } from "@/contexts/theme";
import { useUserSettings } from "@/hooks/useUserSettings";
import {
	buildReleaseCalendarEvents,
	formatMonthLabel,
	getAdjacentMonthKey,
	getCalendarEventEpisodeLabel,
	getReleaseSourcePresentation,
	groupReleaseCalendarEventsByDay,
	type ReleaseCalendarDaySection,
	type ReleaseCalendarEvent,
} from "@/lib/release-calendar";
import { getDayKeyInTimezone, getTmdbPosterUrl } from "@/lib/utils";

export default function CalendarScreen() {
	const { user, isLoading: isAuthLoading, isAuthenticated } = useAuth();
	const { timezone } = useUserSettings();
	const { colors } = useTheme();
	const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);

	const userDid = user?.did ?? "";
	const todayKey = useMemo(
		() => getDayKeyInTimezone(new Date(), timezone),
		[timezone],
	);
	const currentMonthKey = useMemo(() => todayKey.slice(0, 7), [todayKey]);

	useEffect(() => {
		if (!selectedMonthKey) {
			setSelectedMonthKey(currentMonthKey);
		}
	}, [currentMonthKey, selectedMonthKey]);

	const releaseCalendarQuery = useQuery({
		...showsControllerGetUserReleaseCalendarOptions({
			path: { userDid },
		}),
		enabled: !!userDid,
	});

	const releaseEvents = useMemo(
		() =>
			buildReleaseCalendarEvents({
				timezone,
				items:
					(releaseCalendarQuery.data?.items as
						| ReleaseCalendarItemDto[]
						| undefined) ?? [],
			}),
		[timezone, releaseCalendarQuery.data?.items],
	);

	const monthKey = selectedMonthKey ?? currentMonthKey;
	const selectedMonthEvents = useMemo(
		() => releaseEvents.filter((event) => event.monthKey === monthKey),
		[monthKey, releaseEvents],
	);
	const daySections = useMemo(
		() =>
			groupReleaseCalendarEventsByDay({
				events: releaseEvents,
				monthKey,
				timezone,
			}),
		[monthKey, releaseEvents, timezone],
	);

	const isInitialLoading = releaseCalendarQuery.isLoading;
	const isRefreshing =
		releaseCalendarQuery.isRefetching && !releaseCalendarQuery.isLoading;
	const canGoToPreviousMonth = monthKey > currentMonthKey;

	const handleRefresh = useCallback(async () => {
		await releaseCalendarQuery.refetch();
	}, [releaseCalendarQuery]);

	const renderItem = useCallback(
		({ item }: { item: ReleaseCalendarDaySection }) => (
			<DaySection section={item} />
		),
		[],
	);

	const keyExtractor = useCallback(
		(item: ReleaseCalendarDaySection) => item.dayKey,
		[],
	);

	if (isAuthLoading) {
		return (
			<SafeAreaView
				style={[styles.container, { backgroundColor: colors.background }]}
				edges={["top", "left", "right", "bottom"]}
			>
				<Header />
				<CalendarSkeleton />
			</SafeAreaView>
		);
	}

	if (!isAuthenticated || !user) {
		return (
			<SafeAreaView
				style={[styles.container, { backgroundColor: colors.background }]}
				edges={["top", "left", "right", "bottom"]}
			>
				<Header />
				<View style={styles.centerContent}>
					<Card style={styles.stateCard}>
						<CardHeader style={styles.stateCardHeader}>
							<View
								style={[
									styles.stateIconWrap,
									{ backgroundColor: colors.primaryContainer },
								]}
							>
								<Calendar size={28} color={colors.primary} />
							</View>
							<Text style={[styles.stateTitle, { color: colors.onSurface }]}>
								Calendar
							</Text>
							<Text
								style={[
									styles.stateDescription,
									{ color: colors.onSurfaceVariant },
								]}
							>
								Sign in to see upcoming episodes and watchlist releases
							</Text>
						</CardHeader>
						<CardContent>
							<Button onPress={() => router.push("/login")}>
								<LogIn
									size={20}
									color={colors.onPrimary}
									style={styles.buttonIcon}
								/>
								<Text style={[styles.buttonText, { color: colors.onPrimary }]}>
									Sign in
								</Text>
							</Button>
						</CardContent>
					</Card>
				</View>
			</SafeAreaView>
		);
	}

	if (isInitialLoading) {
		return (
			<SafeAreaView
				style={[styles.container, { backgroundColor: colors.background }]}
				edges={["top", "left", "right", "bottom"]}
			>
				<Header />
				<CalendarSkeleton />
			</SafeAreaView>
		);
	}

	if (releaseCalendarQuery.isError) {
		return (
			<SafeAreaView
				style={[styles.container, { backgroundColor: colors.background }]}
				edges={["top", "left", "right", "bottom"]}
			>
				<Header />
				<View style={styles.centerContent}>
					<Card style={styles.stateCard}>
						<CardHeader style={styles.stateCardHeader}>
							<View
								style={[
									styles.stateIconWrap,
									{ backgroundColor: colors.errorContainer },
								]}
							>
								<Calendar size={28} color={colors.error} />
							</View>
							<Text style={[styles.stateTitle, { color: colors.onSurface }]}>
								Release calendar unavailable
							</Text>
							<Text
								style={[
									styles.stateDescription,
									{ color: colors.onSurfaceVariant },
								]}
							>
								The upcoming release feed could not be loaded right now.
							</Text>
						</CardHeader>
						<CardContent>
							<Button onPress={() => void releaseCalendarQuery.refetch()}>
								<Text style={[styles.buttonText, { color: colors.onPrimary }]}>
									Try again
								</Text>
							</Button>
						</CardContent>
					</Card>
				</View>
			</SafeAreaView>
		);
	}

	if (releaseEvents.length === 0) {
		return (
			<SafeAreaView
				style={[styles.container, { backgroundColor: colors.background }]}
				edges={["top", "left", "right", "bottom"]}
			>
				<Header />
				<View style={styles.centerContent}>
					<Card style={styles.stateCard}>
						<CardHeader style={styles.stateCardHeader}>
							<View
								style={[
									styles.stateIconWrap,
									{ backgroundColor: colors.surfaceContainerHigh },
								]}
							>
								<Calendar size={28} color={colors.onSurfaceVariant} />
							</View>
							<Text style={[styles.stateTitle, { color: colors.onSurface }]}>
								No upcoming releases yet
							</Text>
							<Text
								style={[
									styles.stateDescription,
									{ color: colors.onSurfaceVariant },
								]}
							>
								When shows in your Up Next queue get new air dates or something
								in your watchlist has a future release date, it will appear
								here.
							</Text>
						</CardHeader>
						<CardContent>
							<Button onPress={() => router.push("/(tabs)/search")}>
								<Text style={[styles.buttonText, { color: colors.onPrimary }]}>
									Find shows and movies
								</Text>
							</Button>
						</CardContent>
					</Card>
				</View>
			</SafeAreaView>
		);
	}

	return (
		<SafeAreaView
			style={[styles.container, { backgroundColor: colors.background }]}
			edges={["top", "left", "right", "bottom"]}
		>
			<Header />
			<FlashList
				data={daySections}
				renderItem={renderItem}
				keyExtractor={keyExtractor}
				contentContainerStyle={styles.listContent}
				refreshControl={
					<RefreshControl
						refreshing={isRefreshing}
						onRefresh={() => void handleRefresh()}
						tintColor={colors.primary}
						colors={[colors.primary]}
						progressBackgroundColor={colors.surfaceContainerHigh}
					/>
				}
				ListHeaderComponent={
					<View style={styles.listHeader}>
						<MonthNavigator
							monthKey={monthKey}
							eventCount={selectedMonthEvents.length}
							canGoToPreviousMonth={canGoToPreviousMonth}
							onPreviousMonth={() => {
								if (!canGoToPreviousMonth) {
									return;
								}
								setSelectedMonthKey(getAdjacentMonthKey(monthKey, -1));
							}}
							onNextMonth={() =>
								setSelectedMonthKey(getAdjacentMonthKey(monthKey, 1))
							}
						/>
						{selectedMonthEvents.length === 0 ? (
							<View
								style={[
									styles.inlineEmptyState,
									{
										backgroundColor: colors.surfaceContainer,
										borderColor: colors.outlineVariant,
									},
								]}
							>
								<Text
									style={[
										styles.inlineEmptyText,
										{ color: colors.onSurfaceVariant },
									]}
								>
									No releases scheduled this month.
								</Text>
							</View>
						) : null}
					</View>
				}
			/>
		</SafeAreaView>
	);
}

function Header() {
	const { colors } = useTheme();

	return (
		<View style={styles.header}>
			<TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
				<ArrowLeft size={24} color={colors.onBackground} />
			</TouchableOpacity>
			<View style={styles.headerCopy}>
				<Text style={[styles.headerTitle, { color: colors.onBackground }]}>
					Calendar
				</Text>
				<Text
					style={[styles.headerSubtitle, { color: colors.onSurfaceVariant }]}
				>
					Upcoming releases from your queue and watchlist.
				</Text>
			</View>
		</View>
	);
}

function MonthNavigator({
	monthKey,
	eventCount,
	canGoToPreviousMonth,
	onPreviousMonth,
	onNextMonth,
}: {
	monthKey: string;
	eventCount: number;
	canGoToPreviousMonth: boolean;
	onPreviousMonth: () => void;
	onNextMonth: () => void;
}) {
	const { colors } = useTheme();

	return (
		<View
			style={[
				styles.monthCard,
				{
					backgroundColor: colors.surfaceContainerLow,
					borderColor: colors.outlineVariant,
				},
			]}
		>
			<View style={styles.monthCopy}>
				<Text style={[styles.monthLabel, { color: colors.onSurface }]}>
					{formatMonthLabel(monthKey)}
				</Text>
				<Text style={[styles.monthMeta, { color: colors.onSurfaceVariant }]}>
					{eventCount} upcoming release{eventCount !== 1 ? "s" : ""}
				</Text>
			</View>
			<View style={styles.monthActions}>
				<TouchableOpacity
					onPress={onPreviousMonth}
					disabled={!canGoToPreviousMonth}
					style={[
						styles.monthActionButton,
						{
							backgroundColor: canGoToPreviousMonth
								? colors.surfaceContainerHighest
								: colors.surfaceContainer,
							borderColor: colors.outlineVariant,
							opacity: canGoToPreviousMonth ? 1 : 0.45,
						},
					]}
				>
					<ChevronLeft size={18} color={colors.onSurface} />
				</TouchableOpacity>
				<TouchableOpacity
					onPress={onNextMonth}
					style={[
						styles.monthActionButton,
						{
							backgroundColor: colors.surfaceContainerHighest,
							borderColor: colors.outlineVariant,
						},
					]}
				>
					<ChevronRight size={18} color={colors.onSurface} />
				</TouchableOpacity>
			</View>
		</View>
	);
}

function DaySection({ section }: { section: ReleaseCalendarDaySection }) {
	const { colors } = useTheme();

	return (
		<View
			style={[
				styles.daySection,
				{
					backgroundColor: colors.surfaceContainerLow,
					borderColor: colors.outlineVariant,
				},
			]}
		>
			<View
				style={[
					styles.dayHeader,
					{
						backgroundColor: colors.surfaceContainer,
						borderColor: colors.outlineVariant,
					},
				]}
			>
				<View style={styles.dayHeaderCopy}>
					<Text style={[styles.dayHeaderTitle, { color: colors.onSurface }]}>
						{section.label}
					</Text>
					<Text
						style={[styles.dayHeaderCount, { color: colors.onSurfaceVariant }]}
					>
						{section.items.length} release
						{section.items.length !== 1 ? "s" : ""}
					</Text>
				</View>
				<Text style={[styles.dayHeaderKey, { color: colors.onSurfaceVariant }]}>
					{section.dayKey}
				</Text>
			</View>

			<View style={styles.dayItems}>
				{section.items.map((event) => (
					<ReleaseEventCard key={event.id} event={event} />
				))}
			</View>
		</View>
	);
}

function ReleaseEventCard({ event }: { event: ReleaseCalendarEvent }) {
	const { colors } = useTheme();
	const posterUrl = getTmdbPosterUrl(event.posterPath ?? null, "w500");
	const sourcePresentation = getReleaseSourcePresentation(event.source);
	const accentBackground =
		sourcePresentation.tone === "primary"
			? colors.primaryContainer
			: colors.tertiaryContainer;
	const accentColor =
		sourcePresentation.tone === "primary" ? colors.primary : colors.tertiary;
	const accentTextColor =
		sourcePresentation.tone === "primary"
			? colors.onPrimaryContainer
			: colors.onTertiaryContainer;
	const kindLabel =
		event.kind === "episode"
			? getCalendarEventEpisodeLabel(event)
			: event.kind === "movie"
				? "Movie"
				: "Series";

	return (
		<Pressable
			onPress={() => router.push(event.navigationTarget as never)}
			style={({ pressed }) => [
				styles.eventCard,
				{
					backgroundColor: colors.surfaceContainerHighest,
					borderColor: colors.outlineVariant,
					opacity: pressed ? 0.92 : 1,
				},
			]}
		>
			<View style={[styles.eventAccent, { backgroundColor: accentColor }]} />

			<View
				style={[
					styles.posterWrap,
					{ backgroundColor: colors.surfaceContainerHigh },
				]}
			>
				{posterUrl ? (
					<Image
						source={{ uri: posterUrl }}
						style={styles.posterImage}
						contentFit="cover"
						transition={150}
					/>
				) : (
					<View style={styles.posterFallback}>
						<Clapperboard size={18} color={colors.onSurfaceVariant} />
						<Text
							style={[
								styles.posterFallbackText,
								{ color: colors.onSurfaceVariant },
							]}
						>
							No poster
						</Text>
					</View>
				)}
			</View>

			<View style={styles.eventMeta}>
				<View style={styles.eventTop}>
					<View style={styles.eventPillRow}>
						<View
							style={[styles.eventPill, { backgroundColor: accentBackground }]}
						>
							<Text style={[styles.eventPillText, { color: accentTextColor }]}>
								{sourcePresentation.sourceLabel}
							</Text>
						</View>
						<View
							style={[
								styles.eventPill,
								{ backgroundColor: colors.secondaryContainer },
							]}
						>
							<Text
								style={[
									styles.eventPillText,
									{ color: colors.onSecondaryContainer },
								]}
							>
								{kindLabel}
							</Text>
						</View>
					</View>
					<Text style={[styles.eventTitle, { color: colors.onSurface }]}>
						{event.title}
					</Text>
					{event.subtitle ? (
						<Text
							style={[styles.eventSubtitle, { color: colors.onSurfaceVariant }]}
							numberOfLines={2}
						>
							{event.subtitle}
						</Text>
					) : null}
				</View>

				{event.description ? (
					<Text
						style={[
							styles.eventDescription,
							{ color: colors.onSurfaceVariant },
						]}
						numberOfLines={2}
					>
						{event.description}
					</Text>
				) : null}
			</View>
		</Pressable>
	);
}

function CalendarSkeleton() {
	const { colors } = useTheme();

	return (
		<View style={styles.skeletonContainer}>
			<View
				style={[
					styles.monthCard,
					{
						backgroundColor: colors.surfaceContainerLow,
						borderColor: colors.outlineVariant,
					},
				]}
			>
				<View style={styles.monthCopy}>
					<Skeleton width="60%" height={24} />
					<Skeleton width="38%" height={14} style={{ marginTop: spacing.sm }} />
				</View>
				<View style={styles.monthActions}>
					<Skeleton width={42} height={42} borderRadius={borderRadius.full} />
					<Skeleton width={42} height={42} borderRadius={borderRadius.full} />
				</View>
			</View>

			{Array.from({ length: 3 }, (_, index) => (
				<View
					key={`calendar-skeleton-${index + 1}`}
					style={[
						styles.daySection,
						{
							backgroundColor: colors.surfaceContainerLow,
							borderColor: colors.outlineVariant,
						},
					]}
				>
					<View
						style={[
							styles.dayHeader,
							{
								backgroundColor: colors.surfaceContainer,
								borderColor: colors.outlineVariant,
							},
						]}
					>
						<View style={styles.dayHeaderCopy}>
							<Skeleton width={180} height={20} />
							<Skeleton
								width={92}
								height={12}
								style={{ marginTop: spacing.xs }}
							/>
						</View>
						<Skeleton width={90} height={12} />
					</View>

					{Array.from({ length: 2 }, (_, itemIndex) => (
						<View
							key={`calendar-skeleton-item-${index + 1}-${itemIndex + 1}`}
							style={[
								styles.eventCard,
								{
									backgroundColor: colors.surfaceContainerHighest,
									borderColor: colors.outlineVariant,
								},
							]}
						>
							<View
								style={[
									styles.eventAccent,
									{ backgroundColor: colors.primaryContainer },
								]}
							/>
							<Skeleton
								width={84}
								height={126}
								borderRadius={borderRadius.md}
							/>
							<View style={styles.eventMeta}>
								<View style={styles.eventPillRow}>
									<Skeleton
										width={86}
										height={24}
										borderRadius={borderRadius.full}
									/>
									<Skeleton
										width={74}
										height={24}
										borderRadius={borderRadius.full}
									/>
								</View>
								<Skeleton
									width="72%"
									height={18}
									style={{ marginTop: spacing.sm }}
								/>
								<Skeleton
									width="58%"
									height={14}
									style={{ marginTop: spacing.sm }}
								/>
								<Skeleton
									width="88%"
									height={14}
									style={{ marginTop: spacing.md }}
								/>
								<Skeleton
									width="76%"
									height={14}
									style={{ marginTop: spacing.xs }}
								/>
							</View>
						</View>
					))}
				</View>
			))}
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	header: {
		paddingHorizontal: spacing.lg,
		paddingTop: spacing.md,
		paddingBottom: spacing.sm,
		flexDirection: "row",
		alignItems: "flex-start",
		gap: spacing.md,
	},
	backButton: {
		padding: spacing.sm,
		marginLeft: -spacing.sm,
	},
	headerCopy: {
		flex: 1,
		gap: spacing.xs,
	},
	headerTitle: {
		fontSize: 28,
		fontWeight: "700",
	},
	headerSubtitle: {
		fontSize: 14,
		lineHeight: 20,
	},
	listContent: {
		paddingHorizontal: spacing.lg,
		paddingBottom: spacing.xl,
	},
	listHeader: {
		paddingBottom: spacing.md,
	},
	monthCard: {
		borderWidth: 1,
		borderRadius: borderRadius.xxl,
		padding: spacing.md,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: spacing.md,
	},
	monthCopy: {
		flex: 1,
	},
	monthLabel: {
		fontSize: 22,
		fontWeight: "700",
	},
	monthMeta: {
		fontSize: 13,
		marginTop: spacing.xs,
	},
	monthActions: {
		flexDirection: "row",
		gap: spacing.sm,
	},
	monthActionButton: {
		width: 42,
		height: 42,
		borderRadius: borderRadius.full,
		borderWidth: 1,
		alignItems: "center",
		justifyContent: "center",
	},
	inlineEmptyState: {
		borderWidth: 1,
		borderRadius: borderRadius.xl,
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.md,
		marginTop: spacing.md,
	},
	inlineEmptyText: {
		fontSize: 15,
		lineHeight: 20,
	},
	daySection: {
		borderWidth: 1,
		borderRadius: borderRadius.xxl,
		padding: spacing.md,
		marginBottom: spacing.md,
	},
	dayHeader: {
		borderWidth: 1,
		borderRadius: borderRadius.xl,
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.sm + 2,
		flexDirection: "row",
		alignItems: "flex-end",
		justifyContent: "space-between",
		gap: spacing.md,
	},
	dayHeaderCopy: {
		flex: 1,
	},
	dayHeaderTitle: {
		fontSize: 18,
		fontWeight: "700",
		lineHeight: 22,
	},
	dayHeaderCount: {
		fontSize: 13,
		marginTop: spacing.xs,
	},
	dayHeaderKey: {
		fontSize: 11,
		fontWeight: "700",
		textTransform: "uppercase",
	},
	dayItems: {
		gap: spacing.md,
		marginTop: spacing.md,
	},
	eventCard: {
		borderWidth: 1,
		borderRadius: borderRadius.xl,
		padding: spacing.md,
		flexDirection: "row",
		gap: spacing.md,
		overflow: "hidden",
	},
	eventAccent: {
		position: "absolute",
		left: 0,
		top: 0,
		bottom: 0,
		width: 4,
	},
	posterWrap: {
		width: 84,
		aspectRatio: 2 / 3,
		borderRadius: borderRadius.md,
		overflow: "hidden",
		alignItems: "center",
		justifyContent: "center",
	},
	posterImage: {
		width: "100%",
		height: "100%",
	},
	posterFallback: {
		alignItems: "center",
		gap: spacing.xs,
		paddingHorizontal: spacing.xs,
	},
	posterFallbackText: {
		fontSize: 10,
		fontWeight: "600",
		textAlign: "center",
	},
	eventMeta: {
		flex: 1,
		justifyContent: "space-between",
		minHeight: 120,
	},
	eventTop: {
		gap: spacing.xs,
	},
	eventPillRow: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: spacing.xs,
	},
	eventPill: {
		paddingHorizontal: spacing.sm,
		paddingVertical: 4,
		borderRadius: borderRadius.full,
	},
	eventPillText: {
		fontSize: 11,
		fontWeight: "700",
	},
	eventTitle: {
		fontSize: 18,
		fontWeight: "700",
		lineHeight: 22,
	},
	eventSubtitle: {
		fontSize: 14,
		lineHeight: 20,
	},
	eventDescription: {
		fontSize: 14,
		lineHeight: 20,
		marginTop: spacing.sm,
	},
	skeletonContainer: {
		paddingHorizontal: spacing.lg,
		paddingBottom: spacing.xl,
		gap: spacing.md,
	},
	centerContent: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		padding: spacing.xl,
	},
	stateCard: {
		width: "100%",
		maxWidth: 420,
	},
	stateCardHeader: {
		alignItems: "center",
	},
	stateIconWrap: {
		width: 64,
		height: 64,
		borderRadius: borderRadius.full,
		alignItems: "center",
		justifyContent: "center",
		marginBottom: spacing.md,
	},
	stateTitle: {
		fontSize: 24,
		fontWeight: "700",
		textAlign: "center",
		marginBottom: spacing.xs,
	},
	stateDescription: {
		fontSize: 16,
		lineHeight: 22,
		textAlign: "center",
	},
	buttonIcon: {
		marginRight: spacing.sm,
	},
	buttonText: {
		fontSize: 16,
		fontWeight: "600",
	},
});
