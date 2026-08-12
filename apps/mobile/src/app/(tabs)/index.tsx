import { useQueryClient } from "@tanstack/react-query";
import type { Href } from "expo-router";
import { useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AtStoreReviewPrompt } from "@/components/home/atstore-review-prompt";
import { FriendsActivity } from "@/components/home/FriendsActivity";
import { ShelfPreviewRow } from "@/components/home/ShelfPreviewRow";
import { UpcomingReleases } from "@/components/home/UpcomingReleases";
import { UpNextPreview } from "@/components/home/UpNextPreview";
import { WelcomeHeader } from "@/components/home/WelcomeHeader";
import { StatsStrip } from "@/components/profile/StatsStrip";
import {
	registerTourScroller,
	setTourScrollOffset,
} from "@/components/tour/WelcomeTour";
import { TraktHomePrompt } from "@/components/trakt/TraktHomePrompt";
import { useAuth } from "@/lib/auth-context";
import { usePublicProfile } from "@/lib/use-public-profile";

/**
 * Home dashboard. Mirrors the web dashboard route: a welcome greeting, a stats
 * strip (30-day activity + headline counts), the Up Next queue preview, a
 * recent-watched "Your Shelf" row, and upcoming releases. Friends Activity
 * (issue #144) is owned separately and slots in below Up Next.
 *
 * All sections read from the same shared `@opnshelf/api` procedures the web
 * dashboard uses, so the numbers stay identical across surfaces. Each section
 * owns its own loading/empty state; the screen itself is a single ScrollView.
 */
export default function HomeScreen() {
	const insets = useSafeAreaInsets();
	const { user } = useAuth();
	const userDid = user?.did ?? "";
	const queryClient = useQueryClient();
	const [refreshing, setRefreshing] = useState(false);

	// Stats strip is fed by the public profile (same data source as the web
	// dashboard + the mobile profile screen), keyed by the current user's handle.
	const { data: profile, isLoading: profileLoading } = usePublicProfile(
		user?.handle ?? "",
	);

	// Each dashboard section owns its own query internally, so on pull we refetch
	// every active query rather than wiring each section's refetch up by hand.
	const onRefresh = async () => {
		setRefreshing(true);
		try {
			await queryClient.refetchQueries({ type: "active" });
		} finally {
			setRefreshing(false);
		}
	};

	return (
		<View className="flex-1 bg-background">
			<ScrollView
				// Handed to the Welcome Tour so it can scroll its own target into
				// view: the Up Next and Shelf steps point below the fold.
				ref={registerTourScroller}
				onScroll={(event) =>
					setTourScrollOffset(event.nativeEvent.contentOffset.y)
				}
				scrollEventThrottle={64}
				showsVerticalScrollIndicator={false}
				contentContainerStyle={{
					// + 12 = the pt-3 the other tabs give their title row.
					paddingTop: insets.top + 12,
					paddingBottom: 32,
				}}
				refreshControl={
					<RefreshControl
						refreshing={refreshing}
						onRefresh={onRefresh}
						tintColor="#f3bc00"
						colors={["#f3bc00"]}
					/>
				}
			>
				<View className="gap-8 px-4">
					<WelcomeHeader user={user} />
					<TraktHomePrompt />

					<StatsStrip
						activity={profile?.activityLast30Days}
						mostWatchedShow={profile?.mostWatchedShow ?? null}
						watchedThisYear={profile?.watchedThisYear ?? 0}
						reviewsCount={profile?.reviewsCount ?? 0}
						reviewsHref={
							user?.handle
								? (`/profile/${user.handle}/reviews` as Href)
								: undefined
						}
						isLoading={profileLoading || (!profile && !!user?.handle)}
					/>

					<AtStoreReviewPrompt />

					<UpNextPreview handle={user?.handle} />

					{/* Friends Activity (issue #144) slots in here. */}
					<FriendsActivity />

					<ShelfPreviewRow userDid={userDid} />

					<UpcomingReleases />
				</View>
			</ScrollView>
		</View>
	);
}
