import { useLocalSearchParams } from "expo-router";
import { OwnListsScreen } from "@/components/lists/OwnListsScreen";
import { ProfileSubScreen } from "@/components/profile/ProfileSubScreen";
import { ListsTab } from "@/components/profile/tabs/ListsTab";
import { useAuth } from "@/lib/auth-context";
import { isOwnProfileSegment } from "@/lib/own-profile-segment";

/**
 * Lists overview at the Web App's `/profile/{handle}/lists` (ADR 0023). Your
 * own Lists get the screen that creates them; anyone else's are read-only.
 */
export default function ProfileListsScreen() {
	const { handle } = useLocalSearchParams<{ handle: string }>();
	const { user } = useAuth();

	if (user && isOwnProfileSegment(handle ?? "", user)) {
		return <OwnListsScreen handle={user.handle} />;
	}
	return (
		<ProfileSubScreen handle={handle ?? ""} title="Lists">
			{({ userDid, handle: profileHandle }) => (
				<ListsTab userDid={userDid} handle={profileHandle} />
			)}
		</ProfileSubScreen>
	);
}
