import { Tv } from "lucide-react-native";
import { View } from "react-native";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { UpNextCard } from "@/components/up-next/UpNextCard";
import { UpNextSkeleton } from "@/components/up-next/UpNextSkeleton";
import { useProfileUpNext } from "@/lib/use-public-profile";

/**
 * Up Next tab: in-progress shows with their next episode + watch progress.
 * Owners get an "Add to shelf" button that marks the next episode watched.
 * Mirrors the web up-next page.
 */
export function UpNextTab({
	userDid,
	isOwner,
	showHeading = true,
}: {
	userDid: string;
	isOwner: boolean;
	/**
	 * Off for the full-screen drill-down route, where the native stack header
	 * already shows "Up Next" (avoids a duplicate title); on inside the tabbed
	 * profile hub where the section needs its own label.
	 */
	showHeading?: boolean;
}) {
	const { data, isLoading, isError } = useProfileUpNext(userDid);

	const items = data?.items ?? [];

	return (
		<View className="gap-4 px-4 pt-4 pb-12">
			{showHeading ? (
				<Text className="font-bold font-display text-2xl text-foreground">
					Up Next
				</Text>
			) : null}

			{isLoading ? (
				<UpNextSkeleton rows={4} />
			) : isError ? (
				<ErrorState message="Couldn't load Up Next." />
			) : items.length === 0 ? (
				<EmptyState
					icon={Tv}
					title="All caught up!"
					message="No upcoming episodes to watch."
				/>
			) : (
				<View className="gap-3">
					{items.map((item) => (
						<UpNextCard
							key={`${item.showId}-${item.nextEpisode.seasonNumber}-${item.nextEpisode.episodeNumber}`}
							item={item}
							isOwner={isOwner}
						/>
					))}
				</View>
			)}
		</View>
	);
}
