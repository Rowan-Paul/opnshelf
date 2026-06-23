import { Stack } from "expo-router";
import { ScrollView } from "react-native";
import { EditProfile } from "@/components/profile/EditProfile";
import { Screen } from "@/components/ui/screen";
import { ErrorState } from "@/components/ui/states";
import { useAuth } from "@/lib/auth-context";

/**
 * Post-onboarding profile editor screen, reached from Settings. Edits avatar,
 * display name, and Bluesky/Tangled social-link visibility via the shared
 * `EditProfile` component (same backend mutations the web settings page uses).
 */
export default function EditProfileScreen() {
	const { user } = useAuth();

	return (
		<>
			<Stack.Screen options={{ title: "Edit profile" }} />
			<Screen topInset={false}>
				<ScrollView
					className="flex-1"
					contentContainerClassName="gap-6 py-6"
					keyboardShouldPersistTaps="handled"
					showsVerticalScrollIndicator={false}
				>
					{user ? (
						<EditProfile user={user} />
					) : (
						<ErrorState message="You need to be signed in to edit your profile." />
					)}
				</ScrollView>
			</Screen>
		</>
	);
}
