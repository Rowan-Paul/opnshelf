import type { SocialUserCardDto } from "@opnshelf/api";
import { Users } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { UserRow } from "@/components/social/UserRow";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";
import { useFollowers, useFollowing, useFollowToggle } from "@/lib/use-social";

/**
 * Connections tab: Followers / Following sub-tabs for the profile being viewed.
 * Reuses the shared infinite social hooks (keyed by handle) and the follow
 * toggle. Each row links to that user's profile. Mirrors the web Connections
 * page.
 */
export function ConnectionsTab({
	handle,
	myDid,
	initialTab = "followers",
}: {
	handle: string;
	myDid: string;
	initialTab?: "followers" | "following";
}) {
	const [tab, setTab] = useState<"followers" | "following">(initialTab);

	// The header counts deep-link into a specific sub-tab; sync when that changes.
	useEffect(() => {
		setTab(initialTab);
	}, [initialTab]);

	const followers = useFollowers(handle);
	const following = useFollowing(handle);
	const { toggle } = useFollowToggle();

	const active = tab === "followers" ? followers : following;

	return (
		<View className="gap-4 px-4 pt-4 pb-12">
			<Text className="font-bold font-display text-2xl text-foreground">
				Connections
			</Text>

			<View className="flex-row gap-2 border-border border-b">
				{(["followers", "following"] as const).map((key) => {
					const isActive = tab === key;
					return (
						<Pressable
							key={key}
							onPress={() => setTab(key)}
							className={cn(
								"border-b-2 px-3 py-2.5",
								isActive ? "border-primary" : "border-transparent",
							)}
						>
							<Text
								className={cn(
									"font-medium text-sm capitalize",
									isActive ? "text-primary" : "text-muted-foreground",
								)}
							>
								{key}
							</Text>
						</Pressable>
					);
				})}
			</View>

			{active.isLoading ? (
				<View className="py-16">
					<ActivityIndicator color="#f3bc00" />
				</View>
			) : active.isError ? (
				<ErrorState message="Couldn't load this list." />
			) : active.items.length === 0 ? (
				<EmptyState
					icon={Users}
					title={
						tab === "followers" ? "No followers yet" : "Not following anyone"
					}
				/>
			) : (
				<View className="gap-2">
					{active.items.map((user: SocialUserCardDto) => (
						<UserRow
							key={user.did}
							user={user}
							isSelf={user.did === myDid}
							onToggleFollow={toggle}
						/>
					))}
				</View>
			)}
		</View>
	);
}
