import type { UserDto } from "@opnshelf/api";
import { View } from "react-native";
import { Text } from "@/components/ui/text";

/**
 * Home dashboard greeting. Mirrors the web dashboard welcome block:
 * "Welcome back, {name}" with the user's handle beneath. Purely presentational.
 */
export function WelcomeHeader({ user }: { user: UserDto | null }) {
	const name = user?.displayName || user?.handle || "";

	return (
		<View className="gap-1">
			<Text className="font-bold font-display text-3xl text-foreground">
				Welcome back{name ? `, ${name}` : ""}
			</Text>
			{user?.handle ? (
				<Text className="text-muted-foreground text-sm">@{user.handle}</Text>
			) : null}
		</View>
	);
}
