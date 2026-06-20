import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FriendsActivity } from "@/components/home/FriendsActivity";
import { ShelfPreviewRow } from "@/components/home/ShelfPreviewRow";
import { UpcomingReleases } from "@/components/home/UpcomingReleases";
import { UpNextPreview } from "@/components/home/UpNextPreview";
import { WelcomeHeader } from "@/components/home/WelcomeHeader";
import { StatsStrip } from "@/components/profile/StatsStrip";
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

	// Stats strip is fed by the public profile (same data source as the web
	// dashboard + the mobile profile screen), keyed by the current user's handle.
	const { data: profile, isLoading: profileLoading } = usePublicProfile(
		user?.handle ?? "",
	);

	return (
		<View className="flex-1 bg-background">
			<ScrollView
				showsVerticalScrollIndicator={false}
				contentContainerStyle={{
					paddingTop: insets.top + 8,
					paddingBottom: 32,
				}}
			>
				<View className="gap-8 px-4">
					<WelcomeHeader user={user} />

					<StatsStrip
						activity={profile?.activityLast30Days}
						mostWatchedShow={profile?.mostWatchedShow ?? null}
						watchedThisYear={profile?.watchedThisYear ?? 0}
						reviewsCount={profile?.reviewsCount ?? 0}
						isLoading={profileLoading || (!profile && !!user?.handle)}
					/>

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
