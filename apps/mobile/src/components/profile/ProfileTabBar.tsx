import type { LucideIcon } from "lucide-react-native";
import {
	Clock,
	Film,
	LayoutGrid,
	List,
	Star,
	StickyNote,
	Users,
} from "lucide-react-native";
import { Pressable, ScrollView, View } from "react-native";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";

export type ProfileTab =
	| "overview"
	| "shelf"
	| "up-next"
	| "lists"
	| "notes"
	| "reviews"
	| "connections";

const TABS: { key: ProfileTab; label: string; icon: LucideIcon }[] = [
	{ key: "overview", label: "Overview", icon: LayoutGrid },
	{ key: "shelf", label: "Shelf", icon: Film },
	{ key: "up-next", label: "Up Next", icon: Clock },
	{ key: "lists", label: "Lists", icon: List },
	{ key: "notes", label: "Notes", icon: StickyNote },
	{ key: "reviews", label: "Reviews", icon: Star },
	{ key: "connections", label: "Connections", icon: Users },
];

/** Horizontally-scrolling tab bar for the profile screen. */
export function ProfileTabBar({
	active,
	onChange,
}: {
	active: ProfileTab;
	onChange: (tab: ProfileTab) => void;
}) {
	return (
		<View className="border-border border-b">
			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				contentContainerStyle={{ paddingHorizontal: 16, gap: 4 }}
			>
				{TABS.map((tab) => {
					const isActive = active === tab.key;
					const Icon = tab.icon;
					return (
						<Pressable
							key={tab.key}
							onPress={() => onChange(tab.key)}
							className={cn(
								"flex-row items-center gap-1.5 border-b-2 px-3 py-3",
								isActive ? "border-primary" : "border-transparent",
							)}
						>
							<Icon color={isActive ? "#f3bc00" : "#94a3b8"} size={15} />
							<Text
								className={cn(
									"font-medium text-sm",
									isActive ? "text-primary" : "text-muted-foreground",
								)}
							>
								{tab.label}
							</Text>
						</Pressable>
					);
				})}
			</ScrollView>
		</View>
	);
}
