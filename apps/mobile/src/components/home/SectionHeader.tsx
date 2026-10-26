import { type Href, Link } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { Text } from "@/components/ui/text";
import { useTwStyle } from "@/lib/use-tw-style";

/**
 * Section header for Home: the title on the
 * left and an optional "View all" / action link on the right. Mirrors the web
 * dashboard section headers (`<h2>` + accent "View all" link). The right action
 * can be a plain "View all" chevron (pass `href`) or custom content (pass
 * `right`, e.g. the Calendar pill).
 */
export function SectionHeader({
	title,
	href,
	right,
}: {
	title: string;
	href?: Href;
	right?: ReactNode;
}) {
	const linkStyle = useTwStyle("text-primary");
	return (
		<View className="mb-3 flex-row items-center justify-between">
			<View className="min-w-0 flex-1 flex-row items-center gap-2">
				<Text className="flex-1 text-display-3 text-foreground">{title}</Text>
			</View>
			{right ??
				(href ? (
					<Link href={href} asChild>
						<Pressable hitSlop={8} className="flex-row items-center gap-1">
							<Text className="font-medium text-primary text-sm">View all</Text>
							<ChevronRight color={linkStyle.color} size={15} />
						</Pressable>
					</Link>
				) : null)}
		</View>
	);
}
