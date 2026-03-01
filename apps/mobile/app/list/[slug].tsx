import {
	listsControllerDeleteListMutation,
	listsControllerGetListOptions,
	listsControllerGetListQueryKey,
	listsControllerGetUserListsQueryKey,
	listsControllerRemoveItemFromListMutation,
	type MediaInListDto,
} from "@opnshelf/api";
import { FlashList } from "@shopify/flash-list";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, List, Trash2 } from "lucide-react-native";
import { useCallback, useState } from "react";
import {
	type NativeScrollEvent,
	type NativeSyntheticEvent,
	RefreshControl,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import { ConfirmModal } from "@/components/ConfirmModal";
import { MediaCard } from "@/components/MediaCard";
import { ScrollRevealHeader } from "@/components/ScrollRevealHeader";
import { SpinningLoader } from "@/components/SpinningLoader";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { borderRadius, spacing } from "@/constants/spacing";
import { useAuth } from "@/contexts/auth";
import { useTheme } from "@/contexts/theme";
import { useToast } from "@/contexts/toast";
import {
	createTitleSlug,
	getTmdbPosterUrl,
	parseScopedShowMediaId,
} from "@/lib/utils";

export default function ListDetailScreen() {
	const { slug } = useLocalSearchParams<{ slug: string }>();
	const router = useRouter();
	const { user, isAuthenticated } = useAuth();
	const { showToast } = useToast();
	const { colors } = useTheme();
	const queryClient = useQueryClient();
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
	const [showCompactHeader, setShowCompactHeader] = useState(false);

	const {
		data: list,
		isLoading,
		isRefetching: isListRefetching,
		refetch: refetchList,
	} = useQuery({
		...listsControllerGetListOptions({
			path: { slug: slug || "" },
		}),
		enabled: !!user?.did && !!slug,
	});

	const isRefreshing = isListRefetching && !isLoading;

	const handleRefresh = useCallback(async () => {
		await refetchList();
	}, [refetchList]);

	const removeMutation = useMutation({
		mutationKey: ["lists", slug, "removeItem"],
		...listsControllerRemoveItemFromListMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: listsControllerGetListQueryKey({
					path: { slug: slug || "" },
				}),
			});
			showToast("Removed from list", "success");
		},
		onError: () => {
			showToast("Failed to remove. Please try again.", "error");
		},
	});

	const deleteMutation = useMutation({
		mutationKey: ["lists", slug, "delete"],
		...listsControllerDeleteListMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: listsControllerGetUserListsQueryKey(),
			});
			showToast("List deleted", "success");
			router.push("/(tabs)/profile/lists");
		},
		onError: () => {
			showToast("Failed to delete. Please try again.", "error");
		},
	});

	const handleBack = useCallback(() => {
		router.back();
	}, [router]);

	const handleMoviePress = useCallback(
		(item: MediaInListDto) => {
			const title = item.media.title as string;
			if (item.mediaType === "show") {
				const scoped = parseScopedShowMediaId(item.mediaId);
				const showId =
					(item.media as { showId?: string }).showId ??
					scoped.showId ??
					item.mediaId;
				if (
					typeof scoped.seasonNumber === "number" &&
					typeof scoped.episodeNumber === "number"
				) {
					router.push({
						pathname:
							"/show/[id]/season/[seasonNumber]/episode/[episodeNumber]",
						params: {
							id: showId,
							seasonNumber: String(scoped.seasonNumber),
							episodeNumber: String(scoped.episodeNumber),
							title: createTitleSlug(title),
						},
					});
					return;
				}
				if (typeof scoped.seasonNumber === "number") {
					router.push({
						pathname: "/show/[id]/season/[seasonNumber]",
						params: {
							id: showId,
							seasonNumber: String(scoped.seasonNumber),
							title: createTitleSlug(title),
						},
					});
					return;
				}
				router.push({
					pathname: "/show/[id]",
					params: {
						id: showId,
						title: createTitleSlug(title),
					},
				});
			} else {
				router.push({
					pathname: "/movie/[id]",
					params: {
						id: item.mediaId,
						title: createTitleSlug(title),
					},
				});
			}
		},
		[router],
	);

	const handleRemove = useCallback(
		(mediaType: "movie" | "show", mediaId: string) => {
			removeMutation.mutate({
				path: { slug: slug || "", mediaType, mediaId },
			});
		},
		[removeMutation, slug],
	);

	const renderItem = useCallback(
		({ item }: { item: MediaInListDto }) => {
			const isRemoving =
				removeMutation.isPending &&
				removeMutation.variables?.path?.mediaId === item.mediaId;
			return (
				<ListMovieItem
					item={item}
					onPress={() => handleMoviePress(item)}
					onRemove={() =>
						handleRemove(item.mediaType as "movie" | "show", item.mediaId)
					}
					isRemoving={isRemoving}
				/>
			);
		},
		[removeMutation, handleMoviePress, handleRemove],
	);

	const keyExtractor = useCallback((item: MediaInListDto) => item.id, []);

	const handleListScroll = useCallback(
		(event: NativeSyntheticEvent<NativeScrollEvent>) => {
			const shouldShowHeader = event.nativeEvent.contentOffset.y > 100;
			setShowCompactHeader((prev) =>
				prev === shouldShowHeader ? prev : shouldShowHeader,
			);
		},
		[],
	);

	if (!isAuthenticated) {
		return (
			<SafeAreaView
				style={[styles.container, { backgroundColor: colors.background }]}
				edges={["top"]}
			>
				<View style={styles.header}>
					<TouchableOpacity onPress={handleBack} style={styles.backButton}>
						<ArrowLeft size={24} color={colors.onBackground} />
					</TouchableOpacity>
					<Text style={[styles.title, { color: colors.onBackground }]}>
						List
					</Text>
				</View>
				<View style={styles.centerContent}>
					<Text style={[styles.emptyText, { color: colors.onSurfaceVariant }]}>
						Please sign in to view lists
					</Text>
				</View>
			</SafeAreaView>
		);
	}

	if (isLoading) {
		return (
			<SafeAreaView
				style={[styles.container, { backgroundColor: colors.background }]}
				edges={["top"]}
			>
				<View style={styles.header}>
					<TouchableOpacity onPress={handleBack} style={styles.backButton}>
						<ArrowLeft size={24} color={colors.onBackground} />
					</TouchableOpacity>
					<Skeleton width={150} height={28} />
				</View>
				<View style={styles.skeletonContainer}>
					{[1, 2, 3].map((i) => (
						<View
							key={i}
							style={[
								styles.skeletonRow,
								{ backgroundColor: colors.surfaceContainer },
							]}
						>
							<Skeleton width={80} height={120} />
							<View style={styles.skeletonContent}>
								<Skeleton width="70%" height={18} />
								<Skeleton
									width="40%"
									height={14}
									style={{ marginTop: spacing.sm }}
								/>
							</View>
						</View>
					))}
				</View>
			</SafeAreaView>
		);
	}

	if (!list) {
		return (
			<SafeAreaView
				style={[styles.container, { backgroundColor: colors.background }]}
				edges={["top"]}
			>
				<View style={styles.header}>
					<TouchableOpacity onPress={handleBack} style={styles.backButton}>
						<ArrowLeft size={24} color={colors.onBackground} />
					</TouchableOpacity>
					<Text style={[styles.title, { color: colors.onBackground }]}>
						List not found
					</Text>
				</View>
				<View style={styles.centerContent}>
					<Card style={styles.emptyCard}>
						<CardHeader style={styles.emptyCardHeader}>
							<List
								size={64}
								color={colors.onSurfaceVariant}
								style={styles.emptyIcon}
							/>
							<Text style={[styles.emptyTitle, { color: colors.onSurface }]}>
								List not found
							</Text>
							<Text
								style={[
									styles.emptyDescription,
									{ color: colors.onSurfaceVariant },
								]}
							>
								This list doesn&apos;t exist or you don&apos;t have access
							</Text>
						</CardHeader>
						<CardContent>
							<TouchableOpacity
								onPress={handleBack}
								style={[
									styles.backToListsButton,
									{ backgroundColor: colors.primary },
								]}
							>
								<Text
									style={[styles.backToListsText, { color: colors.onPrimary }]}
								>
									Back to lists
								</Text>
							</TouchableOpacity>
						</CardContent>
					</Card>
				</View>
			</SafeAreaView>
		);
	}

	const movies = list.items || [];

	return (
		<GestureHandlerRootView
			style={[styles.container, { backgroundColor: colors.background }]}
		>
			<SafeAreaView
				style={[styles.container, { backgroundColor: colors.background }]}
				edges={["top"]}
			>
				{movies.length === 0 && (
					<View style={styles.header}>
						<TouchableOpacity onPress={handleBack} style={styles.backButton}>
							<ArrowLeft size={24} color={colors.onBackground} />
						</TouchableOpacity>
						<View style={styles.headerContent}>
							<Text
								style={[styles.title, { color: colors.onBackground }]}
								numberOfLines={1}
							>
								{list.name}
							</Text>
							{list.isDefault && (
								<View
									style={[
										styles.defaultBadge,
										{ backgroundColor: `${colors.primary}30` },
									]}
								>
									<Text
										style={[styles.defaultBadgeText, { color: colors.primary }]}
									>
										Default
									</Text>
								</View>
							)}
						</View>
						{!list.isDefault && (
							<TouchableOpacity
								onPress={() => setShowDeleteConfirm(true)}
								disabled={deleteMutation.isPending}
								style={styles.deleteButton}
							>
								<Text
									style={[styles.deleteButtonText, { color: colors.error }]}
								>
									{deleteMutation.isPending ? "..." : "Delete"}
								</Text>
							</TouchableOpacity>
						)}
					</View>
				)}

				{movies.length === 0 && list.description && (
					<Text
						style={[styles.description, { color: colors.onSurfaceVariant }]}
					>
						{list.description}
					</Text>
				)}

				{movies.length > 0 && (
					<FlashList
						data={movies}
						renderItem={renderItem}
						keyExtractor={keyExtractor}
						contentContainerStyle={styles.listContent}
						onScroll={handleListScroll}
						scrollEventThrottle={16}
						ListHeaderComponent={
							<View style={styles.listHeader}>
								<View style={styles.header}>
									<TouchableOpacity
										onPress={handleBack}
										style={styles.backButton}
									>
										<ArrowLeft size={24} color={colors.onBackground} />
									</TouchableOpacity>
									<View style={styles.headerContent}>
										<Text
											style={[styles.title, { color: colors.onBackground }]}
											numberOfLines={1}
										>
											{list.name}
										</Text>
										{list.isDefault && (
											<View
												style={[
													styles.defaultBadge,
													{ backgroundColor: `${colors.primary}30` },
												]}
											>
												<Text
													style={[
														styles.defaultBadgeText,
														{ color: colors.primary },
													]}
												>
													Default
												</Text>
											</View>
										)}
									</View>
									{!list.isDefault && (
										<TouchableOpacity
											onPress={() => setShowDeleteConfirm(true)}
											disabled={deleteMutation.isPending}
											style={styles.deleteButton}
										>
											<Text
												style={[
													styles.deleteButtonText,
													{ color: colors.error },
												]}
											>
												{deleteMutation.isPending ? "..." : "Delete"}
											</Text>
										</TouchableOpacity>
									)}
								</View>
								{list.description && (
									<Text
										style={[
											styles.description,
											{ color: colors.onSurfaceVariant },
										]}
									>
										{list.description}
									</Text>
								)}
								<Text
									style={[
										styles.resultsCount,
										{ color: colors.onSurfaceVariant },
									]}
								>
									{movies.length} item{movies.length !== 1 ? "s" : ""}
								</Text>
							</View>
						}
						ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
						refreshControl={
							<RefreshControl
								refreshing={isRefreshing}
								onRefresh={handleRefresh}
								tintColor={colors.primary}
								colors={[colors.primary]}
								progressBackgroundColor={colors.surfaceContainerHigh}
							/>
						}
					/>
				)}

				{movies.length === 0 && (
					<View style={styles.centerContent}>
						<Card style={styles.emptyCard}>
							<CardHeader style={styles.emptyCardHeader}>
								<List
									size={64}
									color={colors.onSurfaceVariant}
									style={styles.emptyIcon}
								/>
								<Text style={[styles.emptyTitle, { color: colors.onSurface }]}>
									No items yet
								</Text>
								<Text
									style={[
										styles.emptyDescription,
										{ color: colors.onSurfaceVariant },
									]}
								>
									Add items to this list from the search page
								</Text>
							</CardHeader>
							<CardContent>
								<TouchableOpacity
									onPress={() => router.push("/(tabs)/search")}
									style={[
										styles.searchButton,
										{ backgroundColor: colors.primary },
									]}
								>
									<Text
										style={[
											styles.searchButtonText,
											{ color: colors.onPrimary },
										]}
									>
										Search for items
									</Text>
								</TouchableOpacity>
							</CardContent>
						</Card>
					</View>
				)}

				<ScrollRevealHeader
					visible={showCompactHeader}
					onBack={handleBack}
					title={list.name}
				/>
			</SafeAreaView>

			<ConfirmModal
				visible={showDeleteConfirm}
				onClose={() => setShowDeleteConfirm(false)}
				onConfirm={() => {
					setShowDeleteConfirm(false);
					deleteMutation.mutate({ path: { slug } });
				}}
				title="Delete List"
				description={`Are you sure you want to delete "${list.name}"? This action cannot be undone.`}
				confirmText="Delete"
				isLoading={deleteMutation.isPending}
			/>
		</GestureHandlerRootView>
	);
}

interface ListMovieItemProps {
	item: MediaInListDto;
	onPress: () => void;
	onRemove: () => void;
	isRemoving: boolean;
}

function ListMovieItem({
	item,
	onPress,
	onRemove,
	isRemoving,
}: ListMovieItemProps) {
	const { colors } = useTheme();
	const movie = item.media;
	const posterUrl = getTmdbPosterUrl(
		movie.posterPath as string | null | undefined,
	);
	const movieTitle = movie.title as string;
	const releaseYear = movie.releaseYear as number | null | undefined;
	const scopedShow =
		item.mediaType === "show" ? parseScopedShowMediaId(item.mediaId) : null;
	const listContext =
		typeof scopedShow?.seasonNumber === "number" &&
		typeof scopedShow?.episodeNumber === "number"
			? `S${scopedShow.seasonNumber} E${scopedShow.episodeNumber}`
			: typeof scopedShow?.seasonNumber === "number"
				? `Season ${scopedShow.seasonNumber}`
				: null;

	return (
		<MediaCard
			onPress={onPress}
			cardStyle={{
				backgroundColor: colors.surfaceContainer,
				borderColor: colors.outline,
			}}
			mediaContainerStyle={{
				backgroundColor: colors.surfaceContainerHigh,
			}}
			media={
				posterUrl ? (
					<Image
						source={{ uri: posterUrl }}
						style={styles.poster}
						contentFit="cover"
					/>
				) : (
					<View
						style={[
							styles.poster,
							styles.noPoster,
							{ backgroundColor: colors.surfaceContainerHigh },
						]}
					>
						<Text
							style={[styles.noPosterText, { color: colors.onSurfaceVariant }]}
						>
							No poster
						</Text>
					</View>
				)
			}
		>
			<View style={styles.info}>
				<Text
					style={[styles.movieTitle, { color: colors.onSurface }]}
					numberOfLines={2}
				>
					{movieTitle}
				</Text>
				{releaseYear && (
					<Text style={[styles.movieYear, { color: colors.onSurfaceVariant }]}>
						{releaseYear}
					</Text>
				)}
				{listContext && (
					<Text style={[styles.movieYear, { color: colors.onSurfaceVariant }]}>
						{listContext}
					</Text>
				)}
			</View>

			<TouchableOpacity
				onPress={(e) => {
					e.stopPropagation();
					onRemove();
				}}
				disabled={isRemoving}
				style={[styles.removeButton, { backgroundColor: colors.error }]}
				activeOpacity={0.7}
			>
				{isRemoving ? (
					<View style={styles.removeButtonContent}>
						<SpinningLoader size={14} color={colors.onError} />
						<Text style={[styles.removeButtonText, { color: colors.onError }]}>
							Loading
						</Text>
					</View>
				) : (
					<>
						<Trash2 size={14} color={colors.onError} />
						<Text style={[styles.removeButtonText, { color: colors.onError }]}>
							Remove
						</Text>
					</>
				)}
			</TouchableOpacity>
		</MediaCard>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	header: {
		paddingHorizontal: spacing.lg,
		paddingVertical: spacing.md,
		flexDirection: "row",
		alignItems: "center",
	},
	backButton: {
		padding: spacing.sm,
		marginRight: spacing.sm,
	},
	headerContent: {
		flex: 1,
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.sm,
	},
	title: {
		fontSize: 24,
		fontWeight: "bold",
		flex: 1,
	},
	defaultBadge: {
		paddingHorizontal: spacing.sm,
		paddingVertical: 2,
		borderRadius: borderRadius.sm,
	},
	defaultBadgeText: {
		fontSize: 10,
		fontWeight: "600",
	},
	deleteButton: {
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.sm,
	},
	deleteButtonText: {
		fontSize: 14,
		fontWeight: "600",
	},
	description: {
		fontSize: 14,
		paddingHorizontal: spacing.lg,
		marginBottom: spacing.md,
	},
	resultsCount: {
		fontSize: 14,
		paddingHorizontal: spacing.lg,
		marginBottom: spacing.sm,
	},
	listHeader: {
		marginHorizontal: -spacing.lg,
	},
	listContent: {
		padding: spacing.lg,
	},
	itemSeparator: {
		height: spacing.md,
	},
	centerContent: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		padding: spacing.xl,
	},
	emptyCard: {
		width: "100%",
		maxWidth: 400,
		alignItems: "center",
	},
	emptyCardHeader: {
		alignItems: "center",
	},
	emptyIcon: {
		marginBottom: spacing.md,
	},
	emptyTitle: {
		fontSize: 20,
		fontWeight: "bold",
		textAlign: "center",
		marginBottom: spacing.sm,
	},
	emptyDescription: {
		fontSize: 14,
		textAlign: "center",
	},
	emptyText: {
		fontSize: 16,
	},
	backToListsButton: {
		paddingHorizontal: spacing.lg,
		paddingVertical: spacing.md,
		borderRadius: borderRadius.md,
	},
	backToListsText: {
		fontSize: 16,
		fontWeight: "600",
	},
	searchButton: {
		paddingHorizontal: spacing.lg,
		paddingVertical: spacing.md,
		borderRadius: borderRadius.md,
	},
	searchButtonText: {
		fontSize: 16,
		fontWeight: "600",
	},
	skeletonContainer: {
		padding: spacing.lg,
	},
	skeletonRow: {
		flexDirection: "row",
		marginBottom: spacing.md,
		borderRadius: borderRadius.lg,
		overflow: "hidden",
	},
	skeletonContent: {
		flex: 1,
		padding: spacing.md,
		justifyContent: "center",
	},
	poster: {
		width: "100%",
		height: "100%",
	},
	info: {
		flex: 1,
	},
	movieTitle: {
		fontSize: 14,
		fontWeight: "600",
		marginBottom: spacing.xs,
		lineHeight: 19,
	},
	movieYear: {
		fontSize: 12,
	},
	removeButton: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.xs,
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.sm,
		borderRadius: borderRadius.full,
		alignSelf: "flex-start",
		marginTop: spacing.sm,
	},
	removeButtonText: {
		fontSize: 12,
		fontWeight: "600",
	},
	removeButtonContent: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
	},
	noPoster: {
		justifyContent: "center",
		alignItems: "center",
	},
	noPosterText: {
		fontSize: 12,
		fontWeight: "500",
	},
});
