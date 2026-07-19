import { useLocalSearchParams } from "expo-router";
import { ProfileSubScreen } from "@/components/profile/ProfileSubScreen";
import { ShelfTab } from "@/components/profile/tabs/ShelfTab";

/** Full Shelf page — "View all" target from the profile hub's Shelf preview. */
export default function ProfileShelfScreen() {
	const { handle, type } = useLocalSearchParams<{
		handle: string;
		type?: string;
	}>();
	const initialFilter = type === "movie" || type === "episode" ? type : "all";

	return (
		<ProfileSubScreen handle={handle ?? ""} title="Shelf">
			{({ userDid, isOwner }) => (
				<ShelfTab
					userDid={userDid}
					isOwner={isOwner}
					initialFilter={initialFilter}
				/>
			)}
		</ProfileSubScreen>
	);
}
