import { type Href, Link } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { PosterImage } from "@/components/media/PosterImage";
import { Text } from "@/components/ui/text";

/**
 * Horizontal card with a poster thumbnail and a content area, used by the
 * Notes and Reviews tabs. Mirrors the web `ProfileContentCard`: a title + meta
 * header (with an optional right-side actions slot) over arbitrary children.
 * The whole card links to the related media detail route.
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
	const body = (
		<View className="min-w-0 flex-1 gap-1.5">
			<View className="flex-row items-start justify-between gap-2">
				<View className="min-w-0 flex-1">
					<Text
						className="font-display font-semibold text-foreground text-sm"
						numberOfLines={1}
					>
						{title}
					</Text>
					{meta ? (
						<Text className="text-muted-foreground text-xs">{meta}</Text>
					) : null}
				</View>
				{headerRight}
			</View>
			{children}
		</View>
	);

	return (
		<View className="flex-row gap-3 rounded-xl border border-border bg-card p-3">
			{/* Poster links to the media; the body itself may host action buttons. */}
			<Link href={href} asChild>
				<Pressable className="shrink-0">
					<View className="h-28 w-20 overflow-hidden rounded-lg">
						<PosterImage url={posterUrl} className="h-28 w-20" />
					</View>
				</Pressable>
			</Link>
			{body}
		</View>
	);
}
