import {
	checkInsControllerFollowingOptions,
	checkInsControllerProfileOptions,
	type WatchingCheckInDto,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";

export function WatchingActivity({
	items,
	following,
}: {
	items?: WatchingCheckInDto[];
	following?: boolean;
}) {
	if (!items?.length) return null;
	return (
		<ul aria-label="Now watching" className="mb-4 grid gap-2">
			{items.map((item) => (
				<li key={item.rkey} className="card px-4 py-3 text-sm">
					{following && <strong>@{item.handle} is </strong>}
					{following ? "now watching" : "Now watching"} · {item.title}
					{item.seasonNumber != null &&
						` (S${item.seasonNumber}E${item.episodeNumber})`}
				</li>
			))}
		</ul>
	);
}

export function ProfileWatchingActivity({ did }: { did: string }) {
	const { data } = useQuery({
		...checkInsControllerProfileOptions({ path: { did } }),
		refetchInterval: 10_000,
		retry: false,
	});
	return <WatchingActivity items={data?.items} />;
}

export function useFollowingWatchingActivity({
	circleId,
	enabled,
}: {
	circleId?: string;
	enabled: boolean;
}) {
	const { data } = useQuery({
		...checkInsControllerFollowingOptions({ query: { circleId } }),
		enabled,
		refetchInterval: 10_000,
		retry: false,
	});
	return enabled ? (data?.items ?? []) : [];
}
