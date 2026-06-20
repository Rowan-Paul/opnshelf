import { type Href, Link } from "expo-router";
import { ChevronRight, type LucideIcon } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { Text } from "@/components/ui/text";

/**
 * Section header for the home dashboard: an optional leading icon + title on the
 * left and an optional "View all" / action link on the right. Mirrors the web
 * dashboard section headers (`<h2>` + accent "View all" link). The right action
 * can be a plain "View all" chevron (pass `href`) or custom content (pass
 * `right`, e.g. the Calendar pill).
 */
export function SectionHeader({
	icon: Icon,
	title,
	href,
	right,
}: {
	icon?: LucideIcon;
	title: string;
	href?: Href;
	right?: ReactNode;
}) {
	return (
		<View className="mb-3 flex-row items-center justify-between">
			<View className="flex-row items-center gap-2">
				{Icon ? <Icon color="#f3bc00" size={18} /> : null}
				<Text className="font-bold font-display text-foreground text-xl">
					{title}
				</Text>
			</View>
			{right ??
				(href ? (
					<Link href={href} asChild>
						<Pressable hitSlop={8} className="flex-row items-center gap-1">
							<Text className="font-medium text-primary text-sm">View all</Text>
							<ChevronRight color="#f3bc00" size={15} />
						</Pressable>
					</Link>
				) : null)}
		</View>
	);
}
