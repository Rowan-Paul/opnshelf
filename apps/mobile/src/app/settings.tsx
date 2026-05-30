import { Link, Stack } from "expo-router";
import { ChevronRight, Download } from "lucide-react-native";
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

					<Link href="/trakt-import" asChild>
						<Pressable className="flex-row items-center gap-3 rounded-xl border border-border bg-card p-4">
							<Download color="#94a3b8" size={20} />
							<Text className="flex-1 font-medium text-foreground">
								Import from Trakt
							</Text>
							<ChevronRight color="#94a3b8" size={18} />
						</Pressable>
					</Link>

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
