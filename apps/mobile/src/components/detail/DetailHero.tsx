import { LinearGradient } from "expo-linear-gradient";
import { type Href, Link } from "expo-router";
import { Star } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { PosterImage } from "@/components/media/PosterImage";
import { Text } from "@/components/ui/text";
import { useTwStyle } from "@/lib/use-tw-style";

/**
 * Hero header for media detail screens: full-width backdrop with a gradient
 * scrim, an overlapping poster, the title, and an optional rating + subtitle.
 * `children` renders below the title block (e.g. metadata pills). Props-driven
 * so movie and show details share one layout.
 */
export function DetailHero({
	title,
	subtitle,
	backdropUrl,
	posterUrl,
	posterHref,
	rating,
	children,
}: {
	title: string;
	subtitle?: string;
	backdropUrl?: string;
	posterUrl?: string;
	/** When set, the poster becomes a link (e.g. season/episode → show page). */
	posterHref?: Href;
	rating?: number;
	children?: ReactNode;
}) {
	const scrimStyle = useTwStyle("absolute inset-x-0 bottom-0 h-32");
	const poster = (
		<View className="overflow-hidden rounded-lg border border-border bg-card shadow-lg">
			<PosterImage url={posterUrl} className="aspect-2/3 w-24" />
		</View>
	);
	return (
		<View>
			<View className="relative h-52 w-full bg-background-subtle">
				<PosterImage url={backdropUrl} className="h-52 w-full" />
				<LinearGradient
					colors={["transparent", "rgba(2,6,23,0.85)"]}
					style={scrimStyle}
				/>
			</View>

			<View className="-mt-16 flex-row gap-4 px-4">
				{posterHref ? (
					<Link href={posterHref} asChild>
						<Pressable>{poster}</Pressable>
					</Link>
				) : (
					poster
				)}
				<View className="flex-1 justify-end pb-1">
					<Text className="font-bold font-display text-foreground text-xl">
						{title}
					</Text>
					{subtitle ? (
						<Text className="mt-0.5 text-muted-foreground text-sm">
							{subtitle}
						</Text>
					) : null}
					{rating && rating > 0 ? (
						<View className="mt-1 flex-row items-center gap-1">
							<Star color="#f3bc00" fill="#f3bc00" size={14} />
							<Text className="font-medium text-foreground text-sm">
								{rating.toFixed(1)}
							</Text>
						</View>
					) : null}
				</View>
			</View>

			{children ? <View className="mt-3 px-4">{children}</View> : null}
		</View>
	);
}
