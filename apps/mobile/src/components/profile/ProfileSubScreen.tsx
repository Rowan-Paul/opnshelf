import { Stack } from "expo-router";
import type { ReactNode } from "react";
import { View } from "react-native";
import { ProfileHeaderSkeleton } from "@/components/ui/skeletons";
import { ErrorState } from "@/components/ui/states";
import { useAuth } from "@/lib/auth-context";
import { EndReachedScrollView } from "@/lib/use-end-reached";
import { usePublicProfile } from "@/lib/use-public-profile";

/**
 * Shared wrapper for the profile drill-down routes (Shelf, Up Next, Reviews,
 * Connections, …). Resolves the profile from its `[handle]` segment, surfaces a
 * native header with the section title, and renders the section once the
 * `userDid` is known. The dedicated full pages are the "View all" destinations
 * from the self-profile hub, mirroring how Lists already drills into its own
 * screen (issue #151, nav concept A).
 */
export function ProfileSubScreen({
	handle,
	title,
	scroll = true,
	children,
}: {
	handle: string;
	title: string;
	/**
	 * Wrap children in an end-reached ScrollView so paginated sections can load
	 * their next page on scroll. Disable for sections that own their list.
	 */
	scroll?: boolean;
	children: (ctx: {
		userDid: string;
		isOwner: boolean;
		myDid: string;
		handle: string;
	}) => ReactNode;
}) {
	const { user } = useAuth();
	const { data: profile, isLoading, isError } = usePublicProfile(handle);

	const userDid = profile?.did ?? "";
	const myDid = user?.did ?? "";
	const isOwner = !!myDid && myDid === userDid;

	return (
		<View className="flex-1 bg-background">
			<Stack.Screen options={{ headerShown: true, title }} />
			{isLoading ? (
				<ProfileHeaderSkeleton />
			) : isError || !profile ? (
				<ErrorState
					title="Profile not found"
					message="This user doesn't exist or their profile is unavailable."
				/>
			) : scroll ? (
				<EndReachedScrollView showsVerticalScrollIndicator={false}>
					{children({ userDid, isOwner, myDid, handle: profile.handle })}
				</EndReachedScrollView>
			) : (
				children({ userDid, isOwner, myDid, handle: profile.handle })
			)}
		</View>
	);
}
