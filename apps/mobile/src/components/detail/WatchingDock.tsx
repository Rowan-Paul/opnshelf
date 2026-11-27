import {
	formatRuntime,
	moviesControllerGetMovieDetailsOptions,
	showsControllerGetShowDetailsOptions,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { Link, useSegments } from "expo-router";
import { Check, Play, X } from "lucide-react-native";
import { createContext, type ReactNode, useContext, useState } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PosterImage } from "@/components/media/PosterImage";
import { TabOverlayHeightContext } from "@/components/navigation/native-tab-screen";
import { UpdateBanner } from "@/components/UpdateBanner";
import { Button } from "@/components/ui/button";
import { ScreenFrame } from "@/components/ui/screen-frame";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";
import { mediaHref } from "@/lib/media-href";
import {
	useCheckInSuggestion,
	useWatchingCheckIn,
} from "@/lib/use-watching-check-in";
import { useWideLayout } from "@/lib/use-wide-layout";
import { formatWatchDateTime } from "@/lib/watch-date";
import { useThemeColors } from "@/theme/colors";

function WatchingDock({ floating }: { floating: boolean }) {
	const { active, pending, finish, cancel, start } = useWatchingCheckIn(true);
	const { completed, suggestion, clearSuggestion, lookingUp } =
		useCheckInSuggestion(!!active);
	const colors = useThemeColors();
	const { bottom } = useSafeAreaInsets();
	const paddingBottom = floating ? 8 : Math.max(bottom, 8);
	const displayed = active ?? (lookingUp ? completed : undefined);
	const movie = useQuery({
		...moviesControllerGetMovieDetailsOptions({
			path: { movieId: displayed?.mediaId ?? "" },
		}),
		enabled: !!displayed && displayed.episodeNumber == null,
	});
	const show = useQuery({
		...showsControllerGetShowDetailsOptions({
			path: { showId: displayed?.mediaId ?? "" },
		}),
		enabled: displayed?.episodeNumber != null,
	});
	if (!displayed) {
		if (!completed || !suggestion) return null;
		const { title, artworkPath, runtime } = suggestion;
		const episode = suggestion.kind === "episode" ? suggestion : null;
		const status = episode
			? `Watch logged for S${completed.seasonNumber} E${completed.episodeNumber}`
			: "Watch logged";
		const label =
			suggestion.kind === "episode"
				? `Up next · ${suggestion.showName ? `${suggestion.showName} · ` : ""}S${suggestion.target.seasonNumber} E${suggestion.target.episodeNumber}`
				: suggestion.kind === "collection"
					? "Next in collection"
					: "Similar movie";
		const metadata = [
			suggestion.kind === "episode"
				? undefined
				: suggestion.releaseDate?.slice(0, 4),
			formatRuntime(runtime),
		]
			.filter(Boolean)
			.join(" · ");
		return (
			<View className="px-3 pt-2" style={{ paddingBottom }}>
				<View className="gap-3 rounded-xl border border-border bg-card p-3">
					<View className="flex-row items-center gap-1.5 border-border border-b pb-2">
						<Check size={16} color={colors.mutedForeground} />
						<Text
							accessibilityLiveRegion="polite"
							className="flex-1 font-semibold text-muted-foreground text-xs"
						>
							{status}
						</Text>
						<Pressable
							accessibilityRole="button"
							accessibilityLabel="Dismiss suggestion"
							hitSlop={8}
							onPress={clearSuggestion}
							className="size-8 items-center justify-center"
						>
							<X size={18} color={colors.mutedForeground} />
						</Pressable>
					</View>
					<View className="flex-row items-center gap-3">
						{artworkPath && (
							<PosterImage
								url={`https://image.tmdb.org/t/p/w185${artworkPath}`}
								className={cn("h-12 rounded-md", episode ? "w-20" : "w-8")}
							/>
						)}
						<View className="min-w-0 flex-1">
							<Text className="text-muted-foreground text-xs">{label}</Text>
							{suggestion.kind === "episode" ? (
								<Text className="font-semibold text-foreground text-sm">
									{title}
								</Text>
							) : (
								<Link
									href={mediaHref({
										mediaType: "movie",
										mediaId: suggestion.movieId,
										mediaTitle: title,
									})}
									className="font-semibold text-foreground text-sm"
								>
									{title}
								</Link>
							)}
							{metadata ? (
								<Text className="text-muted-foreground text-xs">
									{metadata}
								</Text>
							) : null}
						</View>
					</View>
					<Button
						size="sm"
						label="Start watching"
						disabled={pending}
						onPress={() =>
							start(
								suggestion.kind === "episode"
									? suggestion.target
									: { mediaId: suggestion.movieId },
							)
						}
						leading={<Play size={16} color={colors.accentForeground} />}
					/>
				</View>
			</View>
		);
	}
	const poster =
		displayed.episodeNumber == null
			? movie.data?.poster_path
			: show.data?.poster_path;

	return (
		<View className="px-3 pt-2" style={{ paddingBottom }}>
			<View className="gap-2 rounded-xl border border-border bg-card p-3">
				<View className="flex-row items-center gap-3">
					<PosterImage
						url={poster ? `https://image.tmdb.org/t/p/w92${poster}` : undefined}
						className="h-12 w-8 rounded-sm"
					/>
					<View className="min-w-0 flex-1">
						<View className="flex-row items-center gap-1.5">
							<View className="size-1.5 rounded-full bg-primary" />
							<Text className="font-semibold text-muted-foreground text-xs">
								{lookingUp
									? "Watch logged"
									: displayed.finishing
										? "Logging Watch"
										: "Now watching"}
							</Text>
						</View>
						<Link
							href={mediaHref({
								...displayed,
								mediaType:
									displayed.episodeNumber == null ? "movie" : "episode",
								mediaTitle: show.data?.name ?? displayed.title,
							})}
							className="font-semibold text-foreground text-sm"
							numberOfLines={1}
						>
							{displayed.title}
						</Link>
						{(!displayed.finishing || lookingUp) && (
							<Text className="text-muted-foreground text-xs">
								{lookingUp
									? "Finding what to watch next…"
									: displayed.endsAt
										? `Ends ${formatWatchDateTime(displayed.endsAt)}`
										: "Finish when you’re done"}
							</Text>
						)}
					</View>
				</View>
				{lookingUp ? (
					<View className="h-10" />
				) : (
					<View className="flex-row flex-wrap gap-2">
						<Button
							size="sm"
							variant="primary"
							disabled={pending}
							label={displayed.finishing ? "Retry" : "I’m done"}
							onPress={finish}
						/>
						{!displayed.finishing && (
							<Button
								size="sm"
								variant="ghost"
								disabled={pending}
								label="Cancel check-in"
								onPress={cancel}
							/>
						)}
					</View>
				)}
			</View>
		</View>
	);
}

/** The native tab bar's height above the bottom safe-area inset. */
const TAB_BAR_HEIGHT = process.env.EXPO_OS === "ios" ? 49 : 80;

/** Height the dock takes from the bottom of a pushed screen. */
const PushedDockHeightContext = createContext(0);

/** Frame for pushed screens that ends above the dock. */
export function DockClearFrame({ children }: { children: ReactNode }) {
	const paddingBottom = useContext(PushedDockHeightContext);
	return <ScreenFrame style={{ paddingBottom }}>{children}</ScreenFrame>;
}

function DockSlot({ children }: { children: ReactNode }) {
	const { bottom, left, right } = useSafeAreaInsets();
	const wide = useWideLayout();
	const [height, setHeight] = useState(0);
	const onTabs = useSegments()[0] === "(tabs)";
	// iOS takes the tab bar off the bottom edge in two cases: a wide window
	// puts it at the top, and the iPhone Duo stands it in the right safe area
	// as a rail, which shows as a right inset far larger than the left one.
	const barElsewhere =
		process.env.EXPO_OS === "ios" && (wide || right - left > 40);
	// Above the tab bar when it is at the bottom edge, else on the edge itself.
	const floating = onTabs && !barElsewhere;

	// The dock always overlays the navigator and screens make room for it
	// themselves. Resizing the navigator instead left Android's native tab bar
	// where the shorter navigator had put it.
	return (
		<View className="flex-1 bg-background">
			<TabOverlayHeightContext value={onTabs ? height : 0}>
				<PushedDockHeightContext value={onTabs ? 0 : height}>
					{children}
				</PushedDockHeightContext>
			</TabOverlayHeightContext>
			<View
				pointerEvents="box-none"
				onLayout={(event) => setHeight(event.nativeEvent.layout.height)}
				style={{
					position: "absolute",
					left,
					right,
					bottom: floating ? bottom + TAB_BAR_HEIGHT : 0,
				}}
			>
				<WatchingDock floating={floating} />
			</View>
		</View>
	);
}

export function WatchingDockLayout({ children }: { children: ReactNode }) {
	return (
		<UpdateBanner>
			<DockSlot>{children}</DockSlot>
		</UpdateBanner>
	);
}
