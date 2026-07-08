import { useLocalSearchParams } from "expo-router";
import { ProfileSubScreen } from "@/components/profile/ProfileSubScreen";
import { ReviewsTab } from "@/components/profile/tabs/ReviewsTab";

/** Full Reviews page — "View all" target from the profile hub's Reviews preview. */
export default function ProfileReviewsScreen() {
	const { handle } = useLocalSearchParams<{ handle: string }>();

	return (
		<ProfileSubScreen handle={handle ?? ""} title="Reviews">
			{({ userDid, isOwner }) => (
				<ReviewsTab
					userDid={userDid}
					handle={handle ?? ""}
					isOwner={isOwner}
					showHeading={false}
				/>
			)}
		</ProfileSubScreen>
	);
}
