import { LinearGradient } from "expo-linear-gradient";
import { type Href, Link } from "expo-router";
import { Star } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { PosterImage } from "@/components/media/PosterImage";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/lib/theme-context";
import { useTwStyle } from "@/lib/use-tw-style";

/**
 * Hero header for media detail screens, matching the web `MediaHero`: a
 * full-bleed backdrop sits behind the content and is dissolved into the page
 * with two gradients — one fading up from the bottom, one fading in from the
 * left — so the poster, title and metadata read over it. Props-driven so
 * movie / show / season / episode share the one layout.
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
	const { scheme } = useTheme();
	// The page background as an "r,g,b" triple so the scrims can fade it to
	// varying alpha, exactly like web's from/via-(--background) overlays.
	const bg = scheme === "dark" ? "2,6,23" : "248,250,252";
	const scrimStyle = useTwStyle("absolute inset-0");

	const poster = (
		<View className="h-40 w-28 overflow-hidden rounded-lg border border-border bg-card shadow-lg">
			<PosterImage url={posterUrl} className="h-40 w-28" />
		</View>
	);

	return (
		<View className="relative">
			{/* Backdrop + gradient scrims, behind the content. */}
			<View className="absolute inset-0">
				<PosterImage url={backdropUrl} className="h-full w-full" />
				{/* Vertical: transparent at top → solid background at bottom. */}
				<LinearGradient
					colors={["transparent", `rgba(${bg},0.6)`, `rgb(${bg})`]}
					style={scrimStyle}
				/>
				{/* Horizontal: solid background at left → transparent at right. */}
				<LinearGradient
					colors={[`rgb(${bg})`, `rgba(${bg},0.4)`, "transparent"]}
					start={{ x: 0, y: 0 }}
					end={{ x: 1, y: 0 }}
					style={scrimStyle}
				/>
			</View>

			{/* Content, bottom-anchored over the backdrop. */}
			<View className="px-4 pt-28">
				<View className="flex-row gap-4">
					{posterHref ? (
						<Link href={posterHref} asChild>
							<Pressable>{poster}</Pressable>
						</Link>
					) : (
						poster
					)}
					<View className="flex-1 justify-end pb-1">
						<Text className="font-bold font-display text-2xl text-foreground">
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

				{children ? <View className="mt-4">{children}</View> : null}
			</View>
		</View>
	);
}
