import type { FeaturedDto } from "@opnshelf/api";
import {
	activeFeaturedItems,
	featuredControllerSelectionOptions,
	featuredTitle,
	scheduleFeaturedExpiry,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Link } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Film } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
	Alert,
	Pressable,
	ScrollView,
	Text,
	useWindowDimensions,
	View,
} from "react-native";
import { mediaHref } from "@/lib/media-href";
import { posterUrl } from "@/lib/tmdb";

export function FeaturedContent({ isFocused }: { isFocused: boolean }) {
	const query = useQuery({
		...featuredControllerSelectionOptions(),
		enabled: isFocused,
		staleTime: 0,
		refetchInterval: isFocused ? 30_000 : false,
	});
	const [now, setNow] = useState(Date.now);
	useEffect(() => {
		if (isFocused && query.data?.items)
			return scheduleFeaturedExpiry(query.data.items, setNow);
	}, [isFocused, query.data?.items]);
	const width = Math.min(340, useWindowDimensions().width * 0.84);
	const items = activeFeaturedItems(query.data?.items ?? [], now);
	if (!query.isPending && items.length === 0) return null;
	return (
		<View className="pt-2 pb-4" accessibilityLabel="Featured Content">
			<Text className="mb-3 px-4 font-display font-semibold text-base text-foreground">
				Featured Content
			</Text>
			<ScrollView
				horizontal
				showsHorizontalScrollIndicator
				contentContainerClassName="gap-3 px-4 items-stretch"
			>
				{query.isPending
					? [1, 2].map((id) => (
							<View
								key={id}
								style={{ width }}
								className="h-52 flex-row gap-4 rounded-2xl border border-border bg-card p-4"
								accessibilityLabel="Loading featured content"
							>
								<View className="h-36 w-24 rounded-lg bg-background-subtle" />
								<View className="flex-1 gap-3">
									<View className="h-5 rounded bg-background-subtle" />
									<View className="h-20 rounded bg-background-subtle" />
								</View>
							</View>
						))
					: items.map((item) => (
							<View
								key={item.id}
								style={{ width }}
								className="overflow-hidden rounded-2xl border border-border bg-card"
							>
								<Link
									href={mediaHref({
										mediaType: item.mediaType,
										mediaId: String(item.mediaId),
										mediaTitle: item.title,
										seasonNumber: item.seasonNumber,
									})}
									asChild
								>
									<Pressable
										accessibilityRole="link"
										accessibilityLabel={featuredTitle(item)}
										className="flex-1 flex-row gap-4 p-4"
									>
										<FeaturedPoster item={item} />
										<View className="min-w-0 flex-1">
											<Text className="font-display font-semibold text-base text-foreground">
												{featuredTitle(item)}
											</Text>
											<Text className="mt-2 text-muted-foreground text-sm leading-relaxed">
												{item.message}
											</Text>
										</View>
									</Pressable>
								</Link>
								{item.sourceUrl && (
									<Pressable
										accessibilityRole="link"
										onPress={() => {
											if (item.sourceUrl)
												void WebBrowser.openBrowserAsync(item.sourceUrl).catch(
													() =>
														Alert.alert(
															"Couldn't open link",
															"Please try again.",
														),
												);
										}}
										className="border-border border-t px-4 py-3"
									>
										<Text className="font-medium text-foreground text-sm">
											{item.sourceLabel} ↗
										</Text>
									</Pressable>
								)}
							</View>
						))}
			</ScrollView>
		</View>
	);
}

function FeaturedPoster({ item }: { item: FeaturedDto }) {
	const [failedPoster, setFailedPoster] = useState<string | null>(null);
	return (
		<View className="h-36 w-24 items-center justify-center overflow-hidden rounded-lg bg-background-subtle">
			{item.posterPath && item.posterPath !== failedPoster ? (
				<Image
					source={{ uri: posterUrl(item.posterPath) }}
					style={{ width: 96, height: 144 }}
					contentFit="cover"
					onError={() => setFailedPoster(item.posterPath)}
				/>
			) : (
				<Film
					size={32}
					color="#94a3b8"
					accessibilityLabel="Poster unavailable"
				/>
			)}
		</View>
	);
}
