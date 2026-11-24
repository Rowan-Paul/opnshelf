import {
	checkInsControllerFollowingOptions,
	checkInsControllerProfileOptions,
	type WatchingCheckInDto,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { View } from "react-native";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";

export function WatchingActivity({
	items,
	following,
}: {
	items?: WatchingCheckInDto[];
	following?: boolean;
}) {
	if (!items?.length) return null;
	return (
		<View className="gap-2 px-4 pb-3">
			{items.map((item) => (
				<View
					key={item.rkey}
					className="rounded-lg border border-border bg-card px-4 py-3"
				>
					<Text className="text-foreground text-sm">
						{following ? `@${item.handle} is now watching` : "Now watching"} ·{" "}
						{item.title}
						{item.seasonNumber != null &&
							` (S${item.seasonNumber}E${item.episodeNumber})`}
					</Text>
				</View>
			))}
		</View>
	);
}

export function ProfileWatchingActivity({ did }: { did: string }) {
	const { data } = useQuery({
		...checkInsControllerProfileOptions({ path: { did } }),
		enabled: !!did,
		refetchInterval: 10_000,
		retry: false,
	});
	return <WatchingActivity items={data?.items} />;
}

export function useFollowingWatchingActivity({
	circleId,
}: {
	circleId?: string;
}) {
	const { user } = useAuth();
	const { data } = useQuery({
		...checkInsControllerFollowingOptions({ query: { circleId } }),
		enabled: !!user,
		refetchInterval: 10_000,
		retry: false,
	});
	return user ? (data?.items ?? []) : [];
}
