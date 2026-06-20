import { useLocalSearchParams } from "expo-router";
import { ProfileSubScreen } from "@/components/profile/ProfileSubScreen";
import { UpNextTab } from "@/components/profile/tabs/UpNextTab";

/** Full Up Next page — "View all" target from the profile hub's Up Next preview. */
export default function ProfileUpNextScreen() {
	const { handle } = useLocalSearchParams<{ handle: string }>();

	return (
		<ProfileSubScreen handle={handle ?? ""} title="Up Next">
			{({ userDid, isOwner }) => (
				<UpNextTab userDid={userDid} isOwner={isOwner} />
			)}
		</ProfileSubScreen>
	);
}
