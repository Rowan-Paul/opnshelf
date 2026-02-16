import {
	listsControllerDeleteListMutation,
	listsControllerGetListOptions,
	listsControllerGetListQueryKey,
	listsControllerGetUserListsQueryKey,
	listsControllerRemoveFromListMutation,
	type MovieInListDto,
} from "@opnshelf/api";
import { FlashList } from "@shopify/flash-list";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, List, Trash2 } from "lucide-react-native";
import { useCallback, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import { ConfirmModal } from "@/components/ConfirmModal";
import { SpinningLoader } from "@/components/SpinningLoader";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { borderRadius, spacing } from "@/constants/theme";
import { useAuth } from "@/contexts/auth";
import { useTheme } from "@/contexts/theme";
import { useToast } from "@/contexts/toast";
import { createTitleSlug, getTmdbPosterUrl } from "@/lib/utils";

export default function ListDetailScreen() {
	const { slug } = useLocalSearchParams<{ slug: string }>();
	const router = useRouter();
	const { user, isAuthenticated } = useAuth();
	const { showToast } = useToast();
	const { colors } = useTheme();
	const queryClient = useQueryClient();
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

	const { data: list, isLoading } = useQuery({
		...listsControllerGetListOptions({
			path: { slug: slug || "" },
		}),
		enabled: !!user?.did && !!slug,
	});

	const removeMutation = useMutation({
		...listsControllerRemoveFromListMutation(),
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
		(item: MovieInListDto) => {
			const movieTitle = item.movie.title as string;
			router.push({
				pathname: "/movie/[id]",
				params: {
					id: item.movieId,
					title: createTitleSlug(movieTitle),
				},
			});
		},
		[router],
	);

	const handleRemove = useCallback(
		(movieId: string) => {
			removeMutation.mutate({
				path: { slug: slug || "", movieId },
			});
		},
		[removeMutation, slug],
	);

	const renderItem = useCallback(
		({ item }: { item: MovieInListDto }) => {
			const isRemoving =
				removeMutation.isPending &&
				removeMutation.variables?.path?.movieId === item.movieId;
			return (
				<ListMovieItem
					item={item}
					onPress={() => handleMoviePress(item)}
					onRemove={() => handleRemove(item.movieId)}
					isRemoving={isRemoving}
				/>
			);
		},
		[removeMutation, handleMoviePress, handleRemove],
	);

	const keyExtractor = useCallback((item: MovieInListDto) => item.id, []);

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
							<Text style={[styles.deleteButtonText, { color: colors.error }]}>
								{deleteMutation.isPending ? "..." : "Delete"}
							</Text>
						</TouchableOpacity>
					)}
				</View>

				{list.description && (
					<Text
						style={[styles.description, { color: colors.onSurfaceVariant }]}
					>
						{list.description}
					</Text>
				)}

				{movies.length > 0 && (
					<>
						<Text
							style={[styles.resultsCount, { color: colors.onSurfaceVariant }]}
						>
							{movies.length} movie{movies.length !== 1 ? "s" : ""}
						</Text>
						<FlashList
							data={movies}
							renderItem={renderItem}
							keyExtractor={keyExtractor}
							contentContainerStyle={styles.listContent}
							ItemSeparatorComponent={() => (
								<View style={styles.itemSeparator} />
							)}
						/>
					</>
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
									No movies yet
								</Text>
								<Text
									style={[
										styles.emptyDescription,
										{ color: colors.onSurfaceVariant },
									]}
								>
									Add movies to this list from the search page
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
										Search for movies
									</Text>
								</TouchableOpacity>
							</CardContent>
						</Card>
					</View>
				)}
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
	item: MovieInListDto;
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
	const movie = item.movie;
	const posterUrl = getTmdbPosterUrl(
		movie.posterPath as string | null | undefined,
	);
	const movieTitle = movie.title as string;
	const releaseYear = movie.releaseYear as number | null | undefined;

	return (
		<View
			style={[
				styles.card,
				{
					backgroundColor: colors.surfaceContainer,
					borderColor: colors.outline,
				},
			]}
		>
			<View
				style={[
					styles.posterContainer,
					{ backgroundColor: colors.surfaceContainerHigh },
				]}
			>
				{posterUrl ? (
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
				)}
			</View>
			<TouchableOpacity
				onPress={onPress}
				style={styles.cardContent}
				activeOpacity={0.8}
			>
				<View style={styles.info}>
					<Text
						style={[styles.movieTitle, { color: colors.onSurface }]}
						numberOfLines={2}
					>
						{movieTitle}
					</Text>
					{releaseYear && (
						<Text
							style={[styles.movieYear, { color: colors.onSurfaceVariant }]}
						>
							{releaseYear}
						</Text>
					)}
				</View>

				<TouchableOpacity
					onPress={onRemove}
					disabled={isRemoving}
					style={[styles.removeButton, { backgroundColor: colors.error }]}
					activeOpacity={0.7}
				>
					{isRemoving ? (
						<View style={styles.removeButtonContent}>
							<SpinningLoader size={14} color={colors.onError} />
							<Text
								style={[styles.removeButtonText, { color: colors.onError }]}
							>
								Loading
							</Text>
						</View>
					) : (
						<>
							<Trash2 size={14} color={colors.onError} />
							<Text
								style={[styles.removeButtonText, { color: colors.onError }]}
							>
								Remove
							</Text>
						</>
					)}
				</TouchableOpacity>
			</TouchableOpacity>
		</View>
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
	card: {
		flexDirection: "row",
		borderRadius: borderRadius.lg,
		overflow: "hidden",
		borderWidth: 1,
	},
	posterContainer: {
		width: 80,
		aspectRatio: 2 / 3,
	},
	poster: {
		width: "100%",
		height: "100%",
	},
	cardContent: {
		flex: 1,
		padding: spacing.md,
		justifyContent: "space-between",
	},
	info: {
		flex: 1,
	},
	movieTitle: {
		fontSize: 16,
		fontWeight: "600",
		marginBottom: spacing.xs,
		lineHeight: 22,
	},
	movieYear: {
		fontSize: 14,
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
		fontSize: 14,
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
