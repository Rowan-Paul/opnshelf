import type { ListSummaryDto } from "@opnshelf/api";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { type Href, Link } from "expo-router";
import { ChevronRight, List } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { Text } from "@/components/ui/text";
import { formatRelativeTime } from "@/lib/relative-time";
import { posterUrl } from "@/lib/tmdb";
import { useTwStyle } from "@/lib/use-tw-style";
import { useThemeColors } from "@/theme/colors";

/**
 * One list in a list of lists. Shared by the profile Lists tab and the
 * standalone Lists screen, which carried separate copies of the same row.
 *
 * The same treatment as Web's list card, turned on its side: the cover fills
 * the row blurred, a scrim darkens it toward the text, the crisp poster keeps
 * its 2:3 shape at the leading edge, and the name sits on the artwork rather
 * than beside it. A phone row is horizontal, so the scrim runs left-to-right
 * where Web's runs bottom-to-top — otherwise it is the same idea, and a list
 * reads as the thing it contains instead of as a settings entry.
 *
 * The cover is the list's first item in manual order, served on
 * ListSummaryDto, so a screenful of rows still costs one request.
 */
export function ListSummaryRow({
	list,
	href,
}: {
	list: ListSummaryDto;
	href: Href;
}) {
	const themeColors = useThemeColors();
	const cover = posterUrl(list.coverPosterPath, "w342");
	// expo-image ignores Uniwind's className at runtime, so its geometry has to
	// come through `style` (see PosterImage for the same dance).
	// `inset-0` alone: adding `w-full` would size the fill against the row's
	// content box, so the row's horizontal padding got subtracted and the cover
	// stopped short of the right edge.
	const fillStyle = useTwStyle("absolute inset-0");
	const posterStyle = useTwStyle("h-[72px] w-12 rounded-md");

	return (
		<Link href={href} asChild>
			<Pressable className="relative h-24 flex-row items-center gap-3 overflow-hidden rounded-xl border border-border bg-card px-3">
				{cover ? (
					<>
						<Image
							source={{ uri: cover }}
							style={fillStyle}
							contentFit="cover"
							blurRadius={28}
							transition={{ duration: 200, skipOnCacheHit: "all" }}
						/>
						{/* Darkest where the text sits, so a pale poster still reads. */}
						<LinearGradient
							colors={[
								"rgba(0,0,0,0.82)",
								"rgba(0,0,0,0.5)",
								"rgba(0,0,0,0.3)",
							]}
							start={{ x: 0, y: 0 }}
							end={{ x: 1, y: 0 }}
							style={fillStyle}
						/>
					</>
				) : null}

				<View className="h-[72px] w-12 overflow-hidden rounded-md bg-background-subtle">
					{cover ? (
						<Image
							source={{ uri: cover }}
							style={posterStyle}
							contentFit="cover"
							transition={{ duration: 200, skipOnCacheHit: "all" }}
						/>
					) : (
						// An empty list has no first item to borrow art from.
						<View className="h-[72px] w-12 items-center justify-center">
							<List color={themeColors.mutedForeground} size={18} />
						</View>
					)}
				</View>

				<View className="min-w-0 flex-1">
					<View className="flex-row items-center gap-2">
						<Text
							className={
								cover
									? "shrink font-semibold text-base text-white"
									: "shrink font-semibold text-base text-foreground"
							}
							numberOfLines={1}
						>
							{list.name}
						</Text>
						{/* Same "Default" marker as the Web App's list cards. */}
						{list.isDefault ? (
							<View
								className={
									cover
										? "rounded-full bg-white/25 px-1.5 py-0.5"
										: "rounded-full bg-background-subtle px-1.5 py-0.5"
								}
							>
								<Text
									className={
										cover
											? "text-[10px] text-white"
											: "text-[10px] text-muted-foreground"
									}
								>
									Default
								</Text>
							</View>
						) : null}
					</View>
					{list.description ? (
						<Text
							className={
								cover
									? "text-sm text-white/80"
									: "text-muted-foreground text-sm"
							}
							numberOfLines={1}
						>
							{list.description}
						</Text>
					) : null}
					<Text
						className={
							cover
								? "mt-0.5 text-white/70 text-xs"
								: "mt-0.5 text-muted-foreground text-xs"
						}
					>
						{list.itemCount} item{list.itemCount === 1 ? "" : "s"} · Updated{" "}
						{formatRelativeTime(list.updatedAt)}
					</Text>
				</View>

				<ChevronRight
					color={cover ? "#ffffff" : themeColors.mutedForeground}
					size={18}
				/>
			</Pressable>
		</Link>
	);
}
