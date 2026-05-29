import { Stack } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";

export default function SettingsScreen() {
	const { user, signOut } = useAuth();
	const [isSigningOut, setIsSigningOut] = useState(false);

	const handleSignOut = async () => {
		if (isSigningOut) {
			return;
		}
		setIsSigningOut(true);
		try {
			await signOut();
		} finally {
			setIsSigningOut(false);
		}
	};

	return (
		<>
			<Stack.Screen options={{ title: "Settings" }} />
			<Screen>
				<View className="flex-1 gap-6 pt-6">
					{user && (
						<View className="gap-1">
							<Text className="font-semibold text-foreground text-lg">
								{user.displayName ?? user.handle}
							</Text>
							<Text className="text-muted-foreground text-sm">
								@{user.handle}
							</Text>
						</View>
					)}

					<Pressable
						disabled={isSigningOut}
						onPress={handleSignOut}
						className="flex-row items-center justify-center gap-2 rounded-lg border border-destructive px-4 py-3"
						style={{ opacity: isSigningOut ? 0.7 : 1 }}
					>
						{isSigningOut && <ActivityIndicator size="small" color="#ef4444" />}
						<Text className="font-semibold text-base text-destructive">
							Sign out
						</Text>
					</Pressable>
				</View>
			</Screen>
		</>
	);
}
