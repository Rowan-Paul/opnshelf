import {
	showsControllerGetUserShowsQueryKey,
	showsControllerMarkWatchedMutation,
	type UpNextShowDto,
} from "@opnshelf/api";
import { FlashList } from "@shopify/flash-list";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Check, Tv } from "lucide-react-native";
import {
	ActivityIndicator,
	Pressable,
	RefreshControl,
	StyleSheet,
	Text,
	View,
} from "react-native";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { borderRadius, spacing } from "@/constants/spacing";
import { useTheme } from "@/contexts/theme";
import { useToast } from "@/contexts/toast";
import { useFormattedDate } from "@/hooks/useFormattedDate";
import {
	invalidateUserShelfQueries,
	invalidateUserUpNextQueries,
} from "@/lib/invalidate-shelf";
import { getTmdbPosterUrl } from "@/lib/utils";

const DASHBOARD_LIMIT = 4;

type UpNextShowListProps = {
	items: UpNextShowDto[];
	isLoading: boolean;
	userDid: string;
	variant: "dashboard" | "full";
	showHeader?: boolean;
	onHeaderPress?: () => void;
	hasNextPage?: boolean;
	isFetchingNextPage?: boolean;
	onEndReached?: () => void;
	refreshing?: boolean;
	onRefresh?: () => void;
};

export function UpNextShowList({
	items,
	isLoading,
	userDid,
	variant,
	showHeader = false,
	onHeaderPress,
	hasNextPage = false,
	isFetchingNextPage = false,
	onEndReached,
	refreshing = false,
	onRefresh,
}: UpNextShowListProps) {
	const { colors } = useTheme();
	const { showToast } = useToast();
	const { formatDate } = useFormattedDate();
	const queryClient = useQueryClient();
	const isFull = variant === "full";
	const visibleItems = isFull ? items : items.slice(0, DASHBOARD_LIMIT);

	const markMutation = useMutation({
		mutationKey: ["shows", "episodes", "markWatched"],
		...showsControllerMarkWatchedMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: showsControllerGetUserShowsQueryKey({
					path: { userDid },
				}),
			});
			invalidateUserShelfQueries(queryClient, userDid);
			invalidateUserUpNextQueries(queryClient, userDid);
			showToast("Episode marked watched");
		},
		onError: () => {
			showToast("Failed to mark episode watched", "error");
		},
	});

	const renderCard = ({ item }: { item: UpNextShowDto }) => {
		const posterUrl = getTmdbPosterUrl(item.show.posterPath, "w500");
		const isPending =
			markMutation.isPending &&
			markMutation.variables?.body?.showId === item.showId &&
			markMutation.variables?.body?.seasonNumber ===
				item.nextEpisode.seasonNumber &&
			markMutation.variables?.body?.episodeNumber ===
				item.nextEpisode.episodeNumber;

		return (
			<Pressable
				key={`${item.showId}-${item.nextEpisode.seasonNumber}-${item.nextEpisode.episodeNumber}`}
				onPress={() =>
					router.push({
						pathname: "/show/[id]/season/[seasonNumber]/episode/[episodeNumber]",
						params: {
							id: item.showId,
							seasonNumber: String(item.nextEpisode.seasonNumber),
							episodeNumber: String(item.nextEpisode.episodeNumber),
						},
					})
				}
				style={[
					styles.upNextCard,
					{
						backgroundColor: colors.surfaceContainer,
						borderColor: colors.outline,
					},
				]}
			>
				<View style={styles.posterColumn}>
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
							<View style={styles.posterFallbackWrap}>
								<Tv size={18} color={colors.onSurfaceVariant} />
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
					{item.totalEpisodes > 0 && (
						<View
							style={[
								styles.progressTrack,
								{ backgroundColor: `${colors.primary}33` },
							]}
						>
							<View
								style={[
									styles.progressFill,
									{
										width: `${Math.min(Math.round((item.episodesWatched / item.totalEpisodes) * 100), 100)}%`,
										backgroundColor: colors.primary,
									},
								]}
							/>
						</View>
					)}
				</View>

				<View style={styles.upNextMeta}>
					<View style={styles.metaTop}>
						<View style={styles.pillRow}>
							<View
								style={[
									styles.pill,
									{ backgroundColor: colors.primaryContainer },
								]}
							>
								<Text
									style={[
										styles.pillText,
										{ color: colors.onPrimaryContainer },
									]}
								>
									Up next
								</Text>
							</View>
							<View
								style={[
									styles.pill,
									{ backgroundColor: colors.secondaryContainer },
								]}
							>
								<Text
									style={[
										styles.pillText,
										{ color: colors.onSecondaryContainer },
									]}
								>
									S{item.nextEpisode.seasonNumber} E
									{item.nextEpisode.episodeNumber}
								</Text>
							</View>
						</View>
						<Text
							style={[styles.showTitle, { color: colors.onSurface }]}
							numberOfLines={2}
						>
							{item.show.title}
						</Text>
						<Text
							style={[styles.episodeTitle, { color: colors.onSurfaceVariant }]}
							numberOfLines={2}
						>
							{item.nextEpisode.name}
						</Text>
						{isFull ? (
							<View style={styles.metadataGroup}>
								<Text
									style={[
										styles.metadataText,
										{ color: colors.onSurfaceVariant },
									]}
								>
									Last watched S{item.lastWatched.seasonNumber} E
									{item.lastWatched.episodeNumber}
								</Text>
								{item.nextEpisode.airDate ? (
									<Text
										style={[
											styles.metadataText,
											{ color: colors.onSurfaceVariant },
										]}
									>
										Aired{" "}
										{formatDate(item.nextEpisode.airDate, {
											includeTime: false,
										})}
									</Text>
								) : null}
							</View>
						) : null}
					</View>
					<Pressable
						onPress={(event) => {
							event.stopPropagation();
							markMutation.mutate({
								body: {
									showId: item.showId,
									seasonNumber: item.nextEpisode.seasonNumber,
									episodeNumber: item.nextEpisode.episodeNumber,
								},
							});
						}}
						disabled={isPending}
						style={[
							styles.watchButton,
							{ backgroundColor: colors.primaryContainer },
						]}
					>
						{isPending ? (
							<ActivityIndicator
								size="small"
								color={colors.onPrimaryContainer}
							/>
						) : (
							<Check size={14} color={colors.onPrimaryContainer} />
						)}
						<Text
							style={[
								styles.watchButtonText,
								{ color: colors.onPrimaryContainer },
							]}
						>
							Watch
						</Text>
					</Pressable>
				</View>
			</Pressable>
		);
	};

	const renderEmptyState = () => (
		<Card>
			<CardHeader>
				<Text style={[styles.emptyTitle, { color: colors.onSurface }]}>
					Nothing queued up yet
				</Text>
			</CardHeader>
			<CardContent>
				<Text
					style={[styles.emptyDescription, { color: colors.onSurfaceVariant }]}
				>
					Watch a few episodes and OpnShelf will line up what comes next.
				</Text>
				{isFull ? (
					<Button
						onPress={() => router.push("/(tabs)/search")}
						style={styles.emptyButton}
					>
						<Text style={[styles.buttonText, { color: colors.onPrimary }]}>
							Search for shows
						</Text>
					</Button>
				) : null}
			</CardContent>
		</Card>
	);

	if (isLoading) {
		const skeletonCount = isFull ? 4 : 2;

		return (
			<View style={[styles.section, isFull && styles.fullSectionState]}>
				{showHeader ? (
					<SectionHeader onHeaderPress={onHeaderPress} />
				) : null}
				<View style={styles.sectionSkeleton}>
					{Array.from({ length: skeletonCount }, (_, index) => (
						<UpNextSkeletonCard
							key={`up-next-skeleton-${variant}-${index + 1}`}
							isFull={isFull}
						/>
					))}
				</View>
			</View>
		);
	}

	if (visibleItems.length === 0) {
		return (
			<View style={[styles.section, isFull && styles.fullSectionState]}>
				{showHeader ? (
					<SectionHeader onHeaderPress={onHeaderPress} />
				) : null}
				{renderEmptyState()}
			</View>
		);
	}

	if (!isFull) {
		return (
			<View style={styles.section}>
				{showHeader ? (
					<SectionHeader onHeaderPress={onHeaderPress} />
				) : null}
				<View style={styles.upNextList}>
					{visibleItems.map((item) => renderCard({ item }))}
				</View>
			</View>
		);
	}

	return (
		<FlashList
			data={visibleItems}
			renderItem={renderCard}
			keyExtractor={(item) =>
				`${item.showId}-${item.nextEpisode.seasonNumber}-${item.nextEpisode.episodeNumber}`
			}
			contentContainerStyle={styles.fullListContent}
			onEndReached={() => {
				if (hasNextPage && !isFetchingNextPage) {
					onEndReached?.();
				}
			}}
			onEndReachedThreshold={0.4}
			refreshControl={
				onRefresh ? (
					<RefreshControl
						refreshing={refreshing}
						onRefresh={onRefresh}
						tintColor={colors.primary}
						colors={[colors.primary]}
						progressBackgroundColor={colors.surfaceContainerHigh}
					/>
				) : undefined
			}
			ListFooterComponent={
				isFetchingNextPage ? (
					<View style={styles.footerLoader}>
						<ActivityIndicator size="small" color={colors.primary} />
					</View>
				) : null
			}
		/>
	);
}

function SectionHeader({
	onHeaderPress,
}: {
	onHeaderPress?: () => void;
}) {
	const { colors } = useTheme();

	return (
		<View style={styles.sectionHeader}>
			<View style={styles.sectionHeaderTopRow}>
				<Text style={[styles.sectionTitle, { color: colors.onBackground }]}>
					Up Next
				</Text>
				{onHeaderPress ? (
					<Pressable
						onPress={onHeaderPress}
						style={[
							styles.headerAction,
							{ backgroundColor: colors.surfaceContainerHigh },
						]}
					>
						<Text style={[styles.sectionLink, { color: colors.primary }]}>
							View all
						</Text>
					</Pressable>
				) : null}
			</View>
			<Text
				style={[styles.sectionSubtitle, { color: colors.onSurfaceVariant }]}
			>
				Continue the shows you already have in motion.
			</Text>
		</View>
	);
}

function UpNextSkeletonCard({ isFull }: { isFull: boolean }) {
	const { colors } = useTheme();

	return (
		<View
			style={[
				styles.upNextCard,
				styles.loadingCard,
				{
					backgroundColor: colors.surfaceContainer,
					borderColor: colors.outline,
				},
			]}
		>
			<View style={styles.posterColumn}>
				<Skeleton
					width={84}
					height={126}
					borderRadius={borderRadius.md}
					style={{
						backgroundColor: colors.surfaceContainerHighest,
						borderColor: "transparent",
					}}
				/>
				<Skeleton
					width={84}
					height={3}
					borderRadius={borderRadius.full}
					style={{
						marginTop: 6,
						backgroundColor: colors.surfaceContainerHighest,
						borderColor: "transparent",
					}}
				/>
			</View>
			<View style={styles.upNextMeta}>
				<View style={styles.metaTop}>
					<View style={styles.pillRow}>
						<View
							style={[
								styles.pill,
								{
									backgroundColor: withAlpha(colors.primaryContainer, 0.72),
								},
							]}
						>
							<Skeleton
								width={50}
								height={11}
								borderRadius={borderRadius.full}
								style={styles.loadingPillText}
							/>
						</View>
						<View
							style={[
								styles.pill,
								{
									backgroundColor: withAlpha(colors.secondaryContainer, 0.76),
								},
							]}
						>
							<Skeleton
								width={42}
								height={11}
								borderRadius={borderRadius.full}
								style={styles.loadingPillText}
							/>
						</View>
					</View>
					<View style={styles.loadingTitleStack}>
						<Skeleton
							width="88%"
							height={18}
							style={styles.loadingTextBlock}
						/>
						<Skeleton
							width="74%"
							height={18}
							style={styles.loadingTextBlock}
						/>
						<Skeleton
							width="58%"
							height={14}
							style={styles.loadingSubtextBlock}
						/>
					</View>
					{isFull ? (
						<View style={styles.loadingMetadataGroup}>
							<Skeleton width="56%" height={12} />
							<Skeleton width="44%" height={12} />
						</View>
					) : null}
				</View>
				<View
					style={[
						styles.watchButton,
						styles.loadingWatchButton,
						{
							backgroundColor: withAlpha(colors.primaryContainer, 0.82),
						},
					]}
				>
					<Skeleton
						width={14}
						height={14}
						borderRadius={borderRadius.full}
						style={styles.loadingWatchIcon}
					/>
					<Skeleton
						width={40}
						height={12}
						borderRadius={borderRadius.full}
						style={styles.loadingWatchLabel}
					/>
				</View>
			</View>
		</View>
	);
}

function withAlpha(hex: string, alpha: number): string {
	const normalized = hex.replace("#", "");
	if (normalized.length !== 6) {
		return hex;
	}

	const red = Number.parseInt(normalized.slice(0, 2), 16);
	const green = Number.parseInt(normalized.slice(2, 4), 16);
	const blue = Number.parseInt(normalized.slice(4, 6), 16);

	return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

const styles = StyleSheet.create({
	section: {
		marginBottom: spacing.xl,
	},
	fullSectionState: {
		paddingHorizontal: spacing.lg,
	},
	sectionHeader: {
		gap: spacing.xs,
		marginBottom: spacing.sm,
	},
	sectionHeaderTopRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		gap: spacing.sm,
		minWidth: 0,
	},
	sectionTitle: {
		fontSize: 22,
		fontWeight: "700",
		flexShrink: 1,
	},
	sectionSubtitle: {
		fontSize: 14,
		lineHeight: 20,
	},
	sectionLink: {
		fontSize: 14,
		fontWeight: "600",
	},
	headerAction: {
		paddingHorizontal: spacing.sm,
		paddingVertical: 8,
		borderRadius: borderRadius.full,
	},
	sectionSkeleton: {
		gap: spacing.sm,
	},
	loadingCard: {
		marginBottom: spacing.sm,
		minHeight: 158,
	},
	loadingMetadataGroup: {
		marginTop: spacing.sm,
		gap: spacing.xs,
	},
	loadingTitleStack: {
		gap: spacing.xs,
		marginTop: 2,
	},
	loadingPillText: {
		borderColor: "transparent",
	},
	loadingTextBlock: {
		borderColor: "transparent",
	},
	loadingSubtextBlock: {
		marginTop: spacing.xs,
		borderColor: "transparent",
	},
	loadingWatchButton: {
		alignSelf: "flex-end",
		paddingHorizontal: spacing.md,
		paddingVertical: 8,
	},
	loadingWatchIcon: {
		borderColor: "transparent",
	},
	loadingWatchLabel: {
		borderColor: "transparent",
	},
	upNextList: {
		gap: spacing.sm,
	},
	fullListContent: {
		paddingHorizontal: spacing.lg,
		paddingBottom: spacing.xl,
	},
	upNextCard: {
		flexDirection: "row",
		minHeight: 148,
		borderRadius: borderRadius.lg,
		borderWidth: 1,
		overflow: "hidden",
		alignItems: "stretch",
		padding: spacing.md,
		gap: spacing.md,
		marginBottom: spacing.sm,
	},
	posterColumn: {
		justifyContent: "center",
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
	posterFallbackWrap: {
		alignItems: "center",
		gap: spacing.xs,
	},
	posterFallbackText: {
		fontSize: 10,
		fontWeight: "600",
	},
	progressTrack: {
		height: 3,
		borderRadius: borderRadius.full,
		overflow: "hidden",
		marginTop: 6,
	},
	progressFill: {
		height: "100%",
		borderRadius: borderRadius.full,
	},
	upNextMeta: {
		flex: 1,
		justifyContent: "space-between",
		minHeight: 116,
	},
	metaTop: {
		gap: spacing.xs,
	},
	pillRow: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: spacing.xs,
		marginBottom: spacing.xs,
	},
	pill: {
		paddingHorizontal: spacing.sm,
		paddingVertical: 4,
		borderRadius: borderRadius.full,
	},
	pillText: {
		fontSize: 11,
		fontWeight: "700",
	},
	showTitle: {
		fontSize: 18,
		fontWeight: "700",
		lineHeight: 22,
	},
	episodeTitle: {
		fontSize: 15,
		fontWeight: "600",
		lineHeight: 20,
	},
	metadataGroup: {
		marginTop: spacing.sm,
		gap: spacing.xs,
	},
	metadataText: {
		fontSize: 13,
		lineHeight: 18,
	},
	watchButton: {
		alignSelf: "flex-end",
		borderRadius: borderRadius.full,
		paddingHorizontal: spacing.md,
		paddingVertical: 8,
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.xs,
	},
	watchButtonText: {
		fontSize: 12,
		fontWeight: "700",
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
		alignSelf: "stretch",
		borderRadius: borderRadius.full,
	},
	buttonText: {
		fontSize: 16,
		fontWeight: "600",
	},
	footerLoader: {
		paddingVertical: spacing.md,
		alignItems: "center",
	},
});
