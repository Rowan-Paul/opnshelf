import { Link } from "expo-router";
import { ChevronRight, ListChecks, Settings, Users } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";

export default function ProfileScreen() {
	return (
		<Screen className="px-0">
			<View className="px-4 pb-3">
				<Text className="font-bold font-display text-2xl">Profile</Text>
			</View>
			<View className="gap-2 px-4">
				<Link href="/friends" asChild>
					<Pressable className="flex-row items-center gap-3 rounded-xl border border-border bg-card p-4">
						<Users color="#94a3b8" size={20} />
						<Text className="flex-1 font-medium text-foreground">Friends</Text>
						<ChevronRight color="#94a3b8" size={18} />
					</Pressable>
				</Link>
				<Link href="/lists" asChild>
					<Pressable className="flex-row items-center gap-3 rounded-xl border border-border bg-card p-4">
						<ListChecks color="#94a3b8" size={20} />
						<Text className="flex-1 font-medium text-foreground">Lists</Text>
						<ChevronRight color="#94a3b8" size={18} />
					</Pressable>
				</Link>
				<Link href="/settings" asChild>
					<Pressable className="flex-row items-center gap-3 rounded-xl border border-border bg-card p-4">
						<Settings color="#94a3b8" size={20} />
						<Text className="flex-1 font-medium text-foreground">Settings</Text>
						<ChevronRight color="#94a3b8" size={18} />
					</Pressable>
				</Link>
			</View>
		</Screen>
	);
}
