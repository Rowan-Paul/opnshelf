import type { SocialUserCardDto } from "@opnshelf/api";

interface NetworkStatsProps {
	following: SocialUserCardDto[];
}

export function NetworkStats({ following }: NetworkStatsProps) {
	return (
		<section className="card w-full p-5">
			<h3 className="mb-4 font-display font-semibold">Your Network</h3>
			<div className="space-y-3 text-sm">
				<div className="flex justify-between">
					<span className="text-(--foreground-muted)">Following</span>
					<span className="font-medium">{following.length} people</span>
				</div>
				<div className="flex justify-between">
					<span className="text-(--foreground-muted)">Followers</span>
					<span className="font-medium">
						{following[0]?.followersCount || 0} people
					</span>
				</div>
				<div className="flex justify-between">
					<span className="text-(--foreground-muted)">Mutual</span>
					<span className="font-medium">
						{following.filter((f: SocialUserCardDto) => f.isFollowedBy).length}{" "}
						people
					</span>
				</div>
			</div>
		</section>
	);
}
