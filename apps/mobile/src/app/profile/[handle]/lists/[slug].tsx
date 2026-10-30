import { useLocalSearchParams } from "expo-router";
import { OwnListScreen } from "@/components/lists/OwnListScreen";
import { PublicListScreen } from "@/components/lists/PublicListScreen";
import { useAuth } from "@/lib/auth-context";
import { isOwnProfileSegment } from "@/lib/own-profile-segment";

/**
 * One List at the Web App's `/profile/{handle}/lists/{slug}` (ADR 0023). The
 * owner gets reorder, add and edit; everyone else gets the read-only screen.
 */
export default function ProfileListScreen() {
	const { handle } = useLocalSearchParams<{ handle: string }>();
	const { user } = useAuth();

	return isOwnProfileSegment(handle ?? "", user) ? (
		<OwnListScreen />
	) : (
		<PublicListScreen />
	);
}
