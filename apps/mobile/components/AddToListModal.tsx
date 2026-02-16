import {
	listsControllerAddToListMutation,
	listsControllerGetListsForMovieOptions,
	listsControllerGetListsForMovieQueryKey,
	listsControllerGetListQueryKey,
	listsControllerRemoveFromListMutation,
	type MovieListsForMovieDto,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, memo } from "react";
import {
	ActivityIndicator,
	Modal,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from "react-native";
import { borderRadius, spacing } from "@/constants/spacing";
import { useTheme } from "@/contexts/theme";

interface AddToListModalProps {
	visible: boolean;
	onClose: () => void;
	movieId: string;
	movieTitle: string;
}

export const AddToListModal = memo(function AddToListModal({
	visible,
	onClose,
	movieId,
	movieTitle,
}: AddToListModalProps) {
	const queryClient = useQueryClient();
	const { colors } = useTheme();

	const { data: listsForMovie, isLoading } = useQuery({
		...listsControllerGetListsForMovieOptions({
			path: { movieId },
		}),
		enabled: visible,
	});

	const addMutation = useMutation({
		...listsControllerAddToListMutation(),
		onSuccess: (_, variables) => {
			const slug = variables.path.slug;
			queryClient.invalidateQueries({
				queryKey: listsControllerGetListsForMovieQueryKey({
					path: { movieId },
				}),
			});
			queryClient.invalidateQueries({
				queryKey: listsControllerGetListQueryKey({ path: { slug } }),
			});
		},
	});

	const removeMutation = useMutation({
		...listsControllerRemoveFromListMutation(),
		onSuccess: (_, variables) => {
			const slug = variables.path.slug;
			queryClient.invalidateQueries({
				queryKey: listsControllerGetListsForMovieQueryKey({
					path: { movieId },
				}),
			});
			queryClient.invalidateQueries({
				queryKey: listsControllerGetListQueryKey({ path: { slug } }),
			});
		},
	});

	const handleToggleList = useCallback(
		(slug: string, isInList: boolean) => {
			if (isInList) {
				removeMutation.mutate({
					path: { slug, movieId },
				});
			} else {
				addMutation.mutate({
					path: { slug },
					body: { movieId },
				});
			}
		},
		[addMutation, removeMutation, movieId],
	);

	return (
		<Modal
			visible={visible}
			animationType="fade"
			transparent={true}
			onRequestClose={onClose}
		>
			<Pressable style={styles.overlay} onPress={onClose}>
				<Pressable style={[styles.content, { backgroundColor: colors.surfaceContainer }]} onPress={(e) => e.stopPropagation()}>
					<View style={styles.header}>
						<Text style={[styles.title, { color: colors.onSurface }]}>Manage Lists</Text>
						<Pressable onPress={onClose} hitSlop={8}>
							<Ionicons name="close" size={24} color={colors.onSurface} />
						</Pressable>
					</View>
					<Text style={[styles.description, { color: colors.onSurfaceVariant }]}>
						Add or remove "{movieTitle}" from your lists
					</Text>

					<ScrollView style={styles.listContainer}>
						{isLoading && (
							<View style={styles.loadingContainer}>
								<ActivityIndicator size="large" color={colors.primary} />
							</View>
						)}
						{listsForMovie &&
							listsForMovie.map((list) => (
								<ListItem
									key={list.listId}
									list={list}
									isAddPending={
										addMutation.isPending &&
										addMutation.variables?.path?.slug === list.listSlug
									}
									isRemovePending={
										removeMutation.isPending &&
										removeMutation.variables?.path?.slug === list.listSlug
									}
									onPress={handleToggleList}
								/>
							))}
					</ScrollView>
				</Pressable>
			</Pressable>
		</Modal>
	);
});

interface ListItemProps {
	list: MovieListsForMovieDto;
	isAddPending: boolean;
	isRemovePending: boolean;
	onPress: (slug: string, isInList: boolean) => void;
}

const ListItem = memo(function ListItem({
	list,
	isAddPending,
	isRemovePending,
	onPress,
}: ListItemProps) {
	const { colors } = useTheme();
	const isPending = isAddPending || isRemovePending;
	const isInList = list.isInList;

	return (
		<Pressable
			style={[
				styles.listItem,
				{ backgroundColor: colors.background, borderColor: colors.outline },
				isInList && { backgroundColor: `${colors.primary}20`, borderColor: colors.primary },
			]}
			onPress={() => onPress(list.listSlug, isInList)}
			disabled={isPending}
		>
			<View style={styles.listItemContent}>
				<Text
					style={[styles.listItemText, { color: colors.onSurface }, isInList && { color: colors.primary }]}
				>
					{list.listName}
				</Text>
				{list.isDefault && (
					<View style={[styles.defaultBadge, { backgroundColor: `${colors.primary}30` }]}>
						<Text style={[styles.defaultBadgeText, { color: colors.primary }]}>Default</Text>
					</View>
				)}
			</View>
			{isPending ? (
				<ActivityIndicator size="small" color={colors.primary} />
			) : isInList ? (
				<Ionicons name="remove" size={20} color={colors.primary} />
			) : (
				<Ionicons name="add" size={20} color={colors.onSurfaceVariant} />
			)}
		</Pressable>
	);
});

const styles = StyleSheet.create({
	overlay: {
		flex: 1,
		backgroundColor: "rgba(0, 0, 0, 0.7)",
		justifyContent: "center",
		padding: spacing.lg,
	},
	content: {
		borderRadius: borderRadius.lg,
		padding: spacing.md,
		maxHeight: "70%",
	},
	header: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: spacing.sm,
	},
	title: {
		fontSize: 20,
		fontWeight: "bold",
	},
	description: {
		fontSize: 14,
		marginBottom: spacing.md,
	},
	listContainer: {
		maxHeight: 300,
	},
	loadingContainer: {
		paddingVertical: spacing.xl,
		alignItems: "center",
	},
	listItem: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		padding: spacing.md,
		borderRadius: borderRadius.md,
		marginBottom: spacing.sm,
		borderWidth: 1,
	},
	listItemContent: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.sm,
		flex: 1,
	},
	listItemText: {
		fontSize: 16,
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
});
