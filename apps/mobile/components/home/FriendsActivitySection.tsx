import {
	type FollowedActivityItemDto,
	socialControllerGetFeedOptions,
	socialControllerGetFollowingOptions,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Search } from "lucide-react-native";
import {
	ScrollView,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import { SocialUserAvatar } from "@/components/social/SocialUserAvatar";
import { getDisplayName } from "@/components/social/social-display";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { borderRadius, spacing } from "@/constants/spacing";
import { useTheme } from "@/contexts/theme";
import { useFormattedDate } from "@/hooks/useFormattedDate";
import { createTitleSlug, getTmdbPosterUrl } from "@/lib/utils";

const PAGE_SIZE = 5;

export function FriendsActivitySection({
	userHandle,
}: {
	userHandle: string;
}) {
	const { colors } = useTheme();
	const followingQuery = useQuery({
		...socialControllerGetFollowingOptions({
			path: { handle: userHandle },
			query: { page: 1, pageSize: 1 },
		}),
	});
	const feedQuery = useQuery({
		...socialControllerGetFeedOptions({
			query: { page: 1, pageSize: PAGE_SIZE },
		}),
	});
	const totalFollowing = followingQuery.data?.total ?? 0;
	const items = feedQuery.data?.items ?? [];

	if (followingQuery.isLoading || feedQuery.isLoading) {
		return <FriendsActivitySkeleton />;
	}

	if (totalFollowing === 0) {
		return (
			<View style={styles.section}>
				<FriendsActivityHeader />
				<Card
					style={{
						...styles.stateCard,
						backgroundColor: colors.surfaceContainerHigh,
						borderColor: colors.outlineVariant,
					}}
				>
					<CardHeader>
						<Text style={[styles.stateTitle, { color: colors.onSurface }]}>
							No recent friend activity yet
						</Text>
						<Text
							style={[styles.stateDescription, { color: colors.onSurfaceVariant }]}
						>
							Follow friends on OpnShelf to see what they have watched lately.
						</Text>
					</CardHeader>
					<CardContent>
						<Button
							onPress={() =>
								router.push({
									pathname: "/user/[handle]/friends",
									params: { handle: userHandle, tab: "following" },
								})
							}
						>
							<Search size={18} color={colors.onPrimary} />
							<Text style={[styles.buttonText, { color: colors.onPrimary }]}>
								Find friends
							</Text>
						</Button>
					</CardContent>
				</Card>
			</View>
		);
	}

	if (items.length === 0) {
		return (
			<View style={styles.section}>
				<FriendsActivityHeader />
				<Card
					style={{
						...styles.stateCard,
						backgroundColor: colors.surfaceContainerHigh,
						borderColor: colors.outlineVariant,
					}}
				>
					<CardHeader>
						<Text style={[styles.stateTitle, { color: colors.onSurface }]}>
							No recent friend activity yet
						</Text>
						<Text
							style={[styles.stateDescription, { color: colors.onSurfaceVariant }]}
						>
							You are following friends already. Their watched movies and
							episodes will show up here as soon as they log something new.
						</Text>
					</CardHeader>
				</Card>
			</View>
		);
	}

	return (
		<View style={styles.section}>
			<FriendsActivityHeader />
			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				contentContainerStyle={styles.rail}
			>
				{items.map((item) => (
					<FriendsActivityCard key={item.id} item={item} />
				))}
			</ScrollView>
		</View>
	);
}

function FriendsActivityHeader() {
	const { colors } = useTheme();

	return (
		<View style={styles.header}>
			<Text style={[styles.sectionTitle, { color: colors.onBackground }]}>
				Friends Activity
			</Text>
			<Text style={[styles.sectionDescription, { color: colors.onSurfaceVariant }]}>
				Recent watched activity from friends you follow.
			</Text>
		</View>
	);
}

function FriendsActivitySkeleton() {
	const { colors } = useTheme();

	return (
		<View style={styles.section}>
			<FriendsActivityHeader />
			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				contentContainerStyle={styles.rail}
			>
				{Array.from({ length: 4 }, (_, index) => (
					<View
						key={`friends-activity-skeleton-${index + 1}`}
						style={[
							styles.activityCard,
							{
								backgroundColor: colors.surfaceContainerLow,
								borderColor: colors.outlineVariant,
							},
						]}
					>
						<Skeleton
							width="100%"
							height={236}
							style={[
								styles.posterFrame,
								{ backgroundColor: colors.surfaceContainerHigh },
							]}
						/>
						<View style={styles.activityBody}>
							<Skeleton width="86%" height={18} />
							<Skeleton width="68%" height={18} style={styles.subtitleSkeleton} />
							<View
								style={[
									styles.actorPill,
									{
										backgroundColor: colors.surfaceContainer,
										borderColor: colors.outlineVariant,
									},
								]}
							>
								<Skeleton
									width={32}
									height={32}
									borderRadius={borderRadius.full}
								/>
								<View style={styles.actorCopy}>
									<Skeleton width="72%" height={14} />
									<Skeleton width="88%" height={12} style={styles.actorMetaGap} />
								</View>
							</View>
						</View>
					</View>
				))}
			</ScrollView>
		</View>
	);
}

function FriendsActivityCard({ item }: { item: FollowedActivityItemDto }) {
	const { colors } = useTheme();
	const { is24Hour, timezone } = useFormattedDate();
	const actorName = getDisplayName(item.actor.displayName, item.actor.handle);
	const mediaTitle =
		item.type === "movie"
			? item.title?.trim() || "Untitled movie"
			: item.showTitle?.trim() || "Untitled show";
	const posterUrl = getTmdbPosterUrl(item.posterPath);
	const activityLabel = formatActivityTimestamp(
		item.activityAt,
		timezone,
		is24Hour,
	);

	const openMedia = () => {
		if (item.type === "movie" && item.movieId) {
			router.push({
				pathname: "/movie/[id]",
				params: {
					id: item.movieId,
					title: createTitleSlug(item.title ?? "movie"),
				},
			});
			return;
		}

		if (item.showId && item.seasonNumber && item.episodeNumber) {
			router.push({
				pathname: "/show/[id]/season/[seasonNumber]/episode/[episodeNumber]",
				params: {
					id: item.showId,
					seasonNumber: String(item.seasonNumber),
					episodeNumber: String(item.episodeNumber),
				},
			});
			return;
		}

		if (item.showId) {
			router.push({
				pathname: "/show/[id]",
				params: { id: item.showId },
			});
		}
	};

	return (
		<View
			style={[
				styles.activityCard,
				{
					backgroundColor: colors.surfaceContainerLow,
					borderColor: colors.outlineVariant,
				},
			]}
		>
			<TouchableOpacity
				activeOpacity={0.9}
				onPress={openMedia}
				style={[
					styles.posterFrame,
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
			</TouchableOpacity>

			<View style={styles.activityBody}>
				<TouchableOpacity activeOpacity={0.8} onPress={openMedia}>
					<Text
						numberOfLines={2}
						style={[styles.mediaTitle, { color: colors.onSurface }]}
					>
						{mediaTitle}
					</Text>
				</TouchableOpacity>

				<TouchableOpacity
					activeOpacity={0.85}
					onPress={() =>
						router.push({
							pathname: "/user/[handle]/shelf",
							params: { handle: item.actor.handle },
						})
					}
					style={[
						styles.actorPill,
						{
							backgroundColor: colors.surfaceContainer,
							borderColor: colors.outlineVariant,
						},
					]}
				>
					<SocialUserAvatar
						avatar={item.actor.avatar}
						displayName={item.actor.displayName}
						handle={item.actor.handle}
						size={32}
					/>
					<View style={styles.actorCopy}>
						<Text
							numberOfLines={1}
							style={[styles.actorName, { color: colors.onSurface }]}
						>
							{actorName}
						</Text>
						<Text
							numberOfLines={1}
							style={[styles.actorMeta, { color: colors.onSurfaceVariant }]}
						>
							{activityLabel}
						</Text>
					</View>
				</TouchableOpacity>
			</View>
		</View>
	);
}

function formatActivityTimestamp(
	activityAt: string,
	timezone: string,
	is24Hour: boolean,
) {
	const activityDate = new Date(activityAt);
	const currentYear = new Intl.DateTimeFormat("en-US", {
		timeZone: timezone,
		year: "numeric",
	}).format(new Date());
	const activityYear = new Intl.DateTimeFormat("en-US", {
		timeZone: timezone,
		year: "numeric",
	}).format(activityDate);
	const datePart = new Intl.DateTimeFormat("en-US", {
		timeZone: timezone,
		month: "short",
		day: "numeric",
		...(activityYear === currentYear ? {} : { year: "numeric" }),
	}).format(activityDate);
	const timePart = new Intl.DateTimeFormat("en-US", {
		timeZone: timezone,
		hour: "numeric",
		minute: "2-digit",
		...(is24Hour ? { hour12: false } : { hour12: true }),
	}).format(activityDate);

	return `${datePart} at ${timePart}`;
}

const styles = StyleSheet.create({
	section: {
		marginBottom: spacing.xl,
	},
	header: {
		gap: spacing.xs,
		marginBottom: spacing.md,
	},
	sectionTitle: {
		fontSize: 22,
		fontWeight: "700",
	},
	sectionDescription: {
		fontSize: 14,
		lineHeight: 20,
	},
	rail: {
		gap: spacing.md,
		paddingRight: spacing.lg,
	},
	stateCard: {
		borderWidth: 1,
		borderRadius: borderRadius.xl,
	},
	stateTitle: {
		fontSize: 22,
		fontWeight: "700",
	},
	stateDescription: {
		fontSize: 14,
		lineHeight: 20,
	},
	buttonText: {
		fontSize: 14,
		fontWeight: "700",
	},
	activityCard: {
		width: 176,
		borderWidth: 1,
		borderRadius: borderRadius.xl,
		padding: spacing.sm,
	},
	posterFrame: {
		width: "100%",
		aspectRatio: 2 / 3,
		borderRadius: borderRadius.lg,
		overflow: "hidden",
	},
	posterImage: {
		width: "100%",
		height: "100%",
	},
	posterFallback: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		paddingHorizontal: spacing.md,
	},
	posterFallbackText: {
		fontSize: 13,
		fontWeight: "500",
		textAlign: "center",
	},
	activityBody: {
		flex: 1,
		gap: spacing.sm,
		paddingHorizontal: spacing.xs,
		paddingBottom: spacing.xs,
		paddingTop: spacing.md,
	},
	mediaTitle: {
		fontSize: 16,
		fontWeight: "700",
		lineHeight: 22,
		minHeight: 44,
	},
	subtitleSkeleton: {
		marginTop: spacing.xs,
	},
	actorPill: {
		minHeight: 60,
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.sm,
		borderWidth: 1,
		borderRadius: borderRadius.lg,
		paddingHorizontal: spacing.sm + 2,
		paddingVertical: spacing.sm,
	},
	actorCopy: {
		flex: 1,
	},
	actorName: {
		fontSize: 13,
		fontWeight: "700",
	},
	actorMeta: {
		fontSize: 12,
		marginTop: 4,
	},
	actorMetaGap: {
		marginTop: spacing.xs,
	},
});
