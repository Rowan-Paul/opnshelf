import { type Href, Link } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { PosterImage } from "@/components/media/PosterImage";
import { Text } from "@/components/ui/text";

/**
 * Horizontal card with a poster thumbnail and a content area, used by the
 * Notes and Reviews tabs. Mirrors the web `ProfileContentCard`: a title + meta
 * header (with an optional right-side actions slot) over arbitrary children.
 * Poster and title links leave header actions and body controls independently
 * accessible to screen readers.
 */
export function ProfileContentCard({
	posterUrl,
	href,
	title,
	meta,
	headerRight,
	children,
}: {
	posterUrl?: string;
	href: Href;
	title: string;
	meta?: string;
	headerRight?: ReactNode;
	children: ReactNode;
}) {
	return (
		<View className="flex-row gap-3 rounded-xl border border-border bg-card p-3">
			<Link href={href} asChild>
				<Pressable
					accessible={false}
					accessibilityElementsHidden
					importantForAccessibility="no-hide-descendants"
					className="h-28 w-20 shrink-0 overflow-hidden rounded-lg"
				>
					<PosterImage url={posterUrl} className="h-28 w-20" />
				</Pressable>
			</Link>
			<View className="min-w-0 flex-1 gap-1.5">
				<View className="flex-row items-start justify-between gap-2">
					<Link href={href} asChild>
						<Pressable accessibilityRole="link" className="min-w-0 flex-1">
							<Text
								className="font-display-semibold text-foreground text-sm"
								numberOfLines={1}
							>
								{title}
							</Text>
							{meta ? (
								<Text className="text-muted-foreground text-xs">{meta}</Text>
							) : null}
						</Pressable>
					</Link>
					{headerRight}
				</View>
				{children}
			</View>
		</View>
	);
}
