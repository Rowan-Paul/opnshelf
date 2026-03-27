import {
	type ShowsControllerGetUserUpNextResponse,
	showsControllerGetUserUpNext,
} from "@opnshelf/api";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { ArrowLeft, ArrowUpDown, LogIn, Tv } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import {
	type SortBy,
	type SortOrder,
	SortPickerModal,
	type SortValue,
} from "@/components/up-next/SortPickerModal";
import { UpNextShowList } from "@/components/up-next/UpNextShowList";
import { borderRadius, spacing } from "@/constants/spacing";
import { useAuth } from "@/contexts/auth";
import { useTheme } from "@/contexts/theme";

const PAGE_SIZE = 12;

const SORT_LABELS: Record<SortValue, string> = {
	"lastWatched-desc": "Recently watched",
	"lastWatched-asc": "Oldest watched",
	"title-asc": "Title A-Z",
	"title-desc": "Title Z-A",
	"progress-desc": "Most progress",
	"progress-asc": "Least progress",
};

type UpNextInfiniteQueryKey = [
	{
		_id: "showsControllerGetUserUpNext";
		_infinite: true;
		path: {
			userDid: string;
		};
		query: {
			pageSize: number;
			sortBy: SortBy;
			sortOrder: SortOrder;
		};
	},
];

export default function UpNextScreen() {
	const { user, isLoading: isAuthLoading, isAuthenticated } = useAuth();
	const { colors } = useTheme();
	const queryClient = useQueryClient();
	const userDid = user?.did ?? "";

	const [sortBy, setSortBy] = useState<SortBy>("lastWatched");
	const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
	const [sortModalVisible, setSortModalVisible] = useState(false);
	const sortValue = `${sortBy}-${sortOrder}` as SortValue;

	const queryKey = useMemo(
		() =>
			[
				{
					_id: "showsControllerGetUserUpNext" as const,
					_infinite: true as const,
					path: { userDid },
					query: { pageSize: PAGE_SIZE, sortBy, sortOrder },
				},
			] satisfies UpNextInfiniteQueryKey,
		[userDid, sortBy, sortOrder],
	);

	const upNextQuery = useInfiniteQuery({
		queryKey,
		queryFn: async ({ pageParam, signal }) => {
			const response = await showsControllerGetUserUpNext({
				path: { userDid },
				query: {
					page: pageParam as number,
					pageSize: PAGE_SIZE,
					sortBy,
					sortOrder,
				},
				signal,
				throwOnError: true,
			});

			return response.data;
		},
		enabled: !!userDid,
		initialPageParam: 1,
		getNextPageParam: (lastPage) =>
			lastPage.hasNextPage ? lastPage.page + 1 : undefined,
	});

	const handleSortChange = useCallback(
		(value: SortValue) => {
			const [newSortBy, newSortOrder] = value.split("-") as [SortBy, SortOrder];
			setSortBy(newSortBy);
			setSortOrder(newSortOrder);
			queryClient.removeQueries({ queryKey });
		},
		[queryClient, queryKey],
	);

	const pages = upNextQuery.data?.pages ?? [];
	const items = useMemo(
		() => pages.flatMap((page) => page.items ?? []),
		[pages],
	);
	const isRefreshing =
		upNextQuery.isRefetching &&
		!upNextQuery.isLoading &&
		!upNextQuery.isFetchingNextPage;

	const handleRefresh = useCallback(async () => {
		queryClient.setQueryData(
			queryKey,
			(
				existing:
					| {
							pages: ShowsControllerGetUserUpNextResponse[];
							pageParams: number[];
					  }
					| undefined,
			) =>
				existing
					? {
							pages: existing.pages.slice(0, 1),
							pageParams: [1],
						}
					: existing,
		);
		await upNextQuery.refetch();
	}, [queryClient, queryKey, upNextQuery]);

	if (isAuthLoading) {
		return (
			<SafeAreaView
				style={[styles.container, { backgroundColor: colors.background }]}
				edges={["top", "left", "right", "bottom"]}
			>
				<Header />
				<UpNextShowList items={[]} isLoading userDid="" variant="full" />
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
					<Card style={styles.authCard}>
						<CardHeader style={styles.authCardHeader}>
							<View
								style={[
									styles.authIconWrap,
									{ backgroundColor: colors.primaryContainer },
								]}
							>
								<Tv size={28} color={colors.primary} />
							</View>
							<Text style={[styles.authTitle, { color: colors.onSurface }]}>
								Up Next
							</Text>
							<Text
								style={[
									styles.authDescription,
									{ color: colors.onSurfaceVariant },
								]}
							>
								Sign in to keep track of the next episodes in your queue
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

	return (
		<SafeAreaView
			style={[styles.container, { backgroundColor: colors.background }]}
			edges={["top", "left", "right", "bottom"]}
		>
			<Header
				sortLabel={SORT_LABELS[sortValue]}
				onSortPress={() => setSortModalVisible(true)}
			/>
			<UpNextShowList
				items={items}
				isLoading={upNextQuery.isLoading}
				userDid={userDid}
				variant="full"
				hasNextPage={upNextQuery.hasNextPage}
				isFetchingNextPage={upNextQuery.isFetchingNextPage}
				onEndReached={() => void upNextQuery.fetchNextPage()}
				refreshing={isRefreshing}
				onRefresh={() => void handleRefresh()}
			/>
			<SortPickerModal
				visible={sortModalVisible}
				onClose={() => setSortModalVisible(false)}
				value={sortValue}
				onSelect={handleSortChange}
			/>
		</SafeAreaView>
	);
}

function Header({
	sortLabel,
	onSortPress,
}: {
	sortLabel?: string;
	onSortPress?: () => void;
}) {
	const { colors } = useTheme();

	return (
		<View style={styles.header}>
			<TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
				<ArrowLeft size={24} color={colors.onBackground} />
			</TouchableOpacity>
			<View style={styles.headerCopy}>
				<Text style={[styles.headerTitle, { color: colors.onBackground }]}>
					Up Next
				</Text>
				<Text
					style={[styles.headerSubtitle, { color: colors.onSurfaceVariant }]}
				>
					Pick up exactly where you left off.
				</Text>
			</View>
			{onSortPress && (
				<TouchableOpacity
					onPress={onSortPress}
					style={[
						styles.sortButton,
						{ backgroundColor: colors.surfaceContainerHigh },
					]}
				>
					<ArrowUpDown size={16} color={colors.onSurfaceVariant} />
					{sortLabel && (
						<Text
							style={[styles.sortLabel, { color: colors.onSurfaceVariant }]}
							numberOfLines={1}
						>
							{sortLabel}
						</Text>
					)}
				</TouchableOpacity>
			)}
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
	sortButton: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.xs,
		paddingHorizontal: spacing.sm,
		paddingVertical: spacing.xs + 2,
		borderRadius: borderRadius.full,
		alignSelf: "flex-start",
		marginTop: spacing.xs,
	},
	sortLabel: {
		fontSize: 12,
		fontWeight: "600",
		maxWidth: 100,
	},
	centerContent: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		padding: spacing.xl,
	},
	authCard: {
		width: "100%",
		maxWidth: 420,
	},
	authCardHeader: {
		alignItems: "center",
	},
	authIconWrap: {
		width: 64,
		height: 64,
		borderRadius: borderRadius.full,
		alignItems: "center",
		justifyContent: "center",
		marginBottom: spacing.md,
	},
	authTitle: {
		fontSize: 24,
		fontWeight: "700",
		marginBottom: spacing.xs,
	},
	authDescription: {
		fontSize: 15,
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
