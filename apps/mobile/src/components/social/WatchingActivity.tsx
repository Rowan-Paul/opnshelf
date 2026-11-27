import {
	checkInsControllerFollowingOptions,
	checkInsControllerProfileOptions,
	type WatchingCheckInDto,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { View } from "react-native";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/cn";
import { useWatchingCheckIn } from "@/lib/use-watching-check-in";

export function WatchingActivity({
	items,
	following,
	className = "px-4",
}: {
	items?: WatchingCheckInDto[];
	following?: boolean;
	/** Horizontal inset; pass "" inside a container that already has one. */
	className?: string;
}) {
	if (!items?.length) return null;
	return (
		<View className={cn("gap-2 pb-3", className)}>
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
	const { user } = useAuth();
	// The profile endpoint answers for the public, so it hides the check-in of
	// a Private Shelf. Its owner still sees it, from their own session.
	const own = !!did && user?.did === did;
	const { active } = useWatchingCheckIn(own, own);
	const { data } = useQuery({
		...checkInsControllerProfileOptions({ path: { did } }),
		enabled: !!did && !own,
		refetchInterval: 10_000,
		retry: false,
	});
	const items = own
		? active && !active.finishing
			? [active]
			: []
		: data?.items;
	return <WatchingActivity items={items} />;
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
