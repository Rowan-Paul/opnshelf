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
import { borderRadius, colors, spacing } from "@/constants/theme";
import { useAuth } from "@/contexts/auth";
import { useToast } from "@/contexts/toast";
import { createTitleSlug, getTmdbPosterUrl } from "@/lib/utils";

export default function ListDetailScreen() {
	const { slug } = useLocalSearchParams<{ slug: string }>();
	const router = useRouter();
	const { user, isAuthenticated } = useAuth();
	const { showToast } = useToast();
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
			<SafeAreaView style={styles.container} edges={["top"]}>
				<View style={styles.header}>
					<TouchableOpacity onPress={handleBack} style={styles.backButton}>
						<ArrowLeft size={24} color={colors.text} />
					</TouchableOpacity>
					<Text style={styles.title}>List</Text>
				</View>
				<View style={styles.centerContent}>
					<Text style={styles.emptyText}>Please sign in to view lists</Text>
				</View>
			</SafeAreaView>
		);
	}

	if (isLoading) {
		return (
			<SafeAreaView style={styles.container} edges={["top"]}>
				<View style={styles.header}>
					<TouchableOpacity onPress={handleBack} style={styles.backButton}>
						<ArrowLeft size={24} color={colors.text} />
					</TouchableOpacity>
					<Skeleton width={150} height={28} />
				</View>
				<View style={styles.skeletonContainer}>
					{[1, 2, 3].map((i) => (
						<View key={i} style={styles.skeletonRow}>
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
			<SafeAreaView style={styles.container} edges={["top"]}>
				<View style={styles.header}>
					<TouchableOpacity onPress={handleBack} style={styles.backButton}>
						<ArrowLeft size={24} color={colors.text} />
					</TouchableOpacity>
					<Text style={styles.title}>List not found</Text>
				</View>
				<View style={styles.centerContent}>
					<Card style={styles.emptyCard}>
						<CardHeader style={styles.emptyCardHeader}>
							<List
								size={64}
								color={colors.textSecondary}
								style={styles.emptyIcon}
							/>
							<Text style={styles.emptyTitle}>List not found</Text>
							<Text style={styles.emptyDescription}>
								This list doesn&apos;t exist or you don&apos;t have access
							</Text>
						</CardHeader>
						<CardContent>
							<TouchableOpacity
								onPress={handleBack}
								style={styles.backToListsButton}
							>
								<Text style={styles.backToListsText}>Back to lists</Text>
							</TouchableOpacity>
						</CardContent>
					</Card>
				</View>
			</SafeAreaView>
		);
	}

	const movies = list.items || [];

	return (
		<GestureHandlerRootView style={styles.container}>
			<SafeAreaView style={styles.container} edges={["top"]}>
				<View style={styles.header}>
					<TouchableOpacity onPress={handleBack} style={styles.backButton}>
						<ArrowLeft size={24} color={colors.text} />
					</TouchableOpacity>
					<View style={styles.headerContent}>
						<Text style={styles.title} numberOfLines={1}>
							{list.name}
						</Text>
						{list.isDefault && (
							<View style={styles.defaultBadge}>
								<Text style={styles.defaultBadgeText}>Default</Text>
							</View>
						)}
					</View>
					{!list.isDefault && (
						<TouchableOpacity
							onPress={() => setShowDeleteConfirm(true)}
							disabled={deleteMutation.isPending}
							style={styles.deleteButton}
						>
							<Text style={styles.deleteButtonText}>
								{deleteMutation.isPending ? "..." : "Delete"}
							</Text>
						</TouchableOpacity>
					)}
				</View>

				{list.description && (
					<Text style={styles.description}>{list.description}</Text>
				)}

				{movies.length > 0 && (
					<>
						<Text style={styles.resultsCount}>
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
									color={colors.textSecondary}
									style={styles.emptyIcon}
								/>
								<Text style={styles.emptyTitle}>No movies yet</Text>
								<Text style={styles.emptyDescription}>
									Add movies to this list from the search page
								</Text>
							</CardHeader>
							<CardContent>
								<TouchableOpacity
									onPress={() => router.push("/(tabs)/search")}
									style={styles.searchButton}
								>
									<Text style={styles.searchButtonText}>Search for movies</Text>
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
	const movie = item.movie;
	const posterUrl = getTmdbPosterUrl(
		movie.posterPath as string | null | undefined,
	);
	const movieTitle = movie.title as string;
	const releaseYear = movie.releaseYear as number | null | undefined;

	return (
		<View style={styles.card}>
			<View style={styles.posterContainer}>
				{posterUrl ? (
					<Image
						source={{ uri: posterUrl }}
						style={styles.poster}
						contentFit="cover"
					/>
				) : (
					<View style={[styles.poster, styles.noPoster]}>
						<Text style={styles.noPosterText}>No poster</Text>
					</View>
				)}
			</View>
			<TouchableOpacity
				onPress={onPress}
				style={styles.cardContent}
				activeOpacity={0.8}
			>
				<View style={styles.info}>
					<Text style={styles.movieTitle} numberOfLines={2}>
						{movieTitle}
					</Text>
					{releaseYear && <Text style={styles.movieYear}>{releaseYear}</Text>}
				</View>

				<TouchableOpacity
					onPress={onRemove}
					disabled={isRemoving}
					style={styles.removeButton}
					activeOpacity={0.7}
				>
					{isRemoving ? (
						<View style={styles.removeButtonContent}>
							<SpinningLoader size={14} color={colors.text} />
							<Text style={styles.removeButtonText}>Loading</Text>
						</View>
					) : (
						<>
							<Trash2 size={14} color={colors.text} />
							<Text style={styles.removeButtonText}>Remove</Text>
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
		backgroundColor: colors.background,
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
		color: colors.text,
		flex: 1,
	},
	defaultBadge: {
		backgroundColor: `${colors.primary}30`,
		paddingHorizontal: spacing.sm,
		paddingVertical: 2,
		borderRadius: borderRadius.sm,
	},
	defaultBadgeText: {
		fontSize: 10,
		fontWeight: "600",
		color: colors.primary,
	},
	deleteButton: {
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.sm,
	},
	deleteButtonText: {
		fontSize: 14,
		fontWeight: "600",
		color: colors.error,
	},
	description: {
		fontSize: 14,
		color: colors.textMuted,
		paddingHorizontal: spacing.lg,
		marginBottom: spacing.md,
	},
	resultsCount: {
		fontSize: 14,
		color: colors.textMuted,
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
		color: colors.text,
		textAlign: "center",
		marginBottom: spacing.sm,
	},
	emptyDescription: {
		fontSize: 14,
		color: colors.textMuted,
		textAlign: "center",
	},
	emptyText: {
		fontSize: 16,
		color: colors.textMuted,
	},
	backToListsButton: {
		backgroundColor: colors.primary,
		paddingHorizontal: spacing.lg,
		paddingVertical: spacing.md,
		borderRadius: borderRadius.md,
	},
	backToListsText: {
		color: colors.text,
		fontSize: 16,
		fontWeight: "600",
	},
	searchButton: {
		backgroundColor: colors.primary,
		paddingHorizontal: spacing.lg,
		paddingVertical: spacing.md,
		borderRadius: borderRadius.md,
	},
	searchButtonText: {
		color: colors.text,
		fontSize: 16,
		fontWeight: "600",
	},
	skeletonContainer: {
		padding: spacing.lg,
	},
	skeletonRow: {
		flexDirection: "row",
		marginBottom: spacing.md,
		backgroundColor: colors.card,
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
		backgroundColor: colors.card,
		borderRadius: borderRadius.lg,
		overflow: "hidden",
		borderWidth: 1,
		borderColor: colors.border,
	},
	posterContainer: {
		width: 80,
		aspectRatio: 2 / 3,
		backgroundColor: colors.cardMuted,
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
		color: colors.text,
		marginBottom: spacing.xs,
		lineHeight: 22,
	},
	movieYear: {
		fontSize: 14,
		color: colors.textMuted,
	},
	removeButton: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.xs,
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.sm,
		backgroundColor: colors.error,
		borderRadius: borderRadius.full,
		alignSelf: "flex-start",
		marginTop: spacing.sm,
	},
	removeButtonText: {
		color: colors.text,
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
		backgroundColor: colors.cardMuted,
	},
	noPosterText: {
		color: colors.textSecondary,
		fontSize: 12,
		fontWeight: "500",
	},
});
