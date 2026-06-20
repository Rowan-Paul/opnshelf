import { Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import {
	type ProfileTab,
	ProfileTabBar,
} from "@/components/profile/ProfileTabBar";
import { ConnectionsTab } from "@/components/profile/tabs/ConnectionsTab";
import { ListsTab } from "@/components/profile/tabs/ListsTab";
import { NotesTab } from "@/components/profile/tabs/NotesTab";
import { OverviewTab } from "@/components/profile/tabs/OverviewTab";
import { ReviewsTab } from "@/components/profile/tabs/ReviewsTab";
import { ShelfTab } from "@/components/profile/tabs/ShelfTab";
import { UpNextTab } from "@/components/profile/tabs/UpNextTab";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { useAuth } from "@/lib/auth-context";
import { usePublicProfile } from "@/lib/use-public-profile";

/**
 * Public profile screen for any handle (own or another user's). Renders a
 * header (avatar, name, follow), a scrollable tab bar, and the active tab's
 * content — mirroring the web `profile.$handle` route group (Overview, Shelf,
 * Up Next, Lists, Notes, Reviews, Connections) plus the stats strip.
 *
 * Implemented as one screen with internal tab state (rather than nested Expo
 * Router routes) so the header + profile query are shared and switching tabs is
 * instant; deep tabs are still reachable via the header counts ("View all").
 */
const PROFILE_TABS: readonly ProfileTab[] = [
	"overview",
	"shelf",
	"up-next",
	"lists",
	"notes",
	"reviews",
	"connections",
];

function toProfileTab(value: string | undefined): ProfileTab {
	return value && (PROFILE_TABS as readonly string[]).includes(value)
		? (value as ProfileTab)
		: "overview";
}

export default function ProfileScreen() {
	const {
		handle,
		tab: tabParam,
		type: typeParam,
	} = useLocalSearchParams<{
		handle: string;
		tab?: string;
		type?: string;
	}>();
	const { user, isAuthenticated } = useAuth();

	const { data: profile, isLoading, isError } = usePublicProfile(handle ?? "");

	const [tab, setTab] = useState<ProfileTab>(() => toProfileTab(tabParam));
	const [shelfFilter, setShelfFilter] = useState<"all" | "movie" | "episode">(
		() =>
			typeParam === "movie" || typeParam === "episode" ? typeParam : "all",
	);
	const [connectionsTab, setConnectionsTab] = useState<
		"followers" | "following"
	>("followers");

	// Switch tab from the Overview "View all" links; for the shelf, also carry
	// the type filter so e.g. "Recent Movies → View all" lands on movies only.
	const navigate = (next: ProfileTab, shelfType?: "movie" | "episode") => {
		if (shelfType) setShelfFilter(shelfType);
		setTab(next);
	};

	const userDid = profile?.did ?? "";
	const isOwner = !!user?.did && user.did === userDid;
	const myDid = user?.did ?? "";

	const title = profile?.displayName || profile?.handle || "Profile";

	const goToConnections = (sub: "followers" | "following") => {
		setConnectionsTab(sub);
		setTab("connections");
	};

	return (
		<View className="flex-1 bg-background">
			<Stack.Screen options={{ headerShown: true, title }} />

			{isLoading ? (
				<LoadingState />
			) : isError || !profile ? (
				<ErrorState
					title="Profile not found"
					message="This user doesn't exist or their profile is unavailable."
				/>
			) : (
				<ScrollView
					stickyHeaderIndices={[1]}
					showsVerticalScrollIndicator={false}
				>
					<ProfileHeader
						profile={profile}
						handle={profile.handle}
						isOwner={isOwner}
						isAuthenticated={isAuthenticated}
						onPressConnections={goToConnections}
					/>

					<View className="bg-background">
						<ProfileTabBar active={tab} onChange={setTab} />
					</View>

					{tab === "overview" ? (
						<OverviewTab
							profile={profile}
							userDid={userDid}
							onNavigate={navigate}
						/>
					) : tab === "shelf" ? (
						<ShelfTab
							key={`shelf-${shelfFilter}`}
							userDid={userDid}
							initialFilter={shelfFilter}
						/>
					) : tab === "up-next" ? (
						<UpNextTab userDid={userDid} isOwner={isOwner} />
					) : tab === "lists" ? (
						<ListsTab userDid={userDid} />
					) : tab === "notes" ? (
						<NotesTab userDid={userDid} isOwner={isOwner} />
					) : tab === "reviews" ? (
						<ReviewsTab userDid={userDid} isOwner={isOwner} />
					) : (
						<ConnectionsTab
							handle={profile.handle}
							myDid={myDid}
							initialTab={connectionsTab}
						/>
					)}
				</ScrollView>
			)}
		</View>
	);
}
