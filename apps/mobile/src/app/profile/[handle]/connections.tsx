import { useLocalSearchParams } from "expo-router";
import { ProfileSubScreen } from "@/components/profile/ProfileSubScreen";
import { ConnectionsTab } from "@/components/profile/tabs/ConnectionsTab";

/**
 * Full Connections page (Followers / Following) — target from the profile
 * header counts and the hub's Connections preview. The `tab` param deep-links
 * straight into Followers or Following.
 */
export default function ProfileConnectionsScreen() {
	const { handle, tab } = useLocalSearchParams<{
		handle: string;
		tab?: string;
	}>();
	const initialTab = tab === "following" ? "following" : "followers";

	return (
		<ProfileSubScreen handle={handle ?? ""} title="Connections">
			{({ handle: resolvedHandle, myDid }) => (
				<ConnectionsTab
					handle={resolvedHandle}
					myDid={myDid}
					initialTab={initialTab}
					showHeading={false}
				/>
			)}
		</ProfileSubScreen>
	);
}
