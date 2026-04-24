import type { SocialUserCardDto } from "@opnshelf/api";
import { Loader2, UserCheck, UserX } from "lucide-react";
import { UserAvatar } from "./UserAvatar";

interface FollowingListProps {
	following: SocialUserCardDto[];
	isLoading: boolean;
	error: Error | null;
	onUnfollow: (did: string) => void;
	isUnfollowPending: boolean;
}

export function FollowingList({
	following,
	isLoading,
	error,
	onUnfollow,
	isUnfollowPending,
}: FollowingListProps) {
	return (
		<section className="card p-5">
			<h3 className="mb-4 font-display font-semibold">
				Following ({following.length})
			</h3>
			{isLoading ? (
				<div className="flex items-center justify-center py-4">
					<Loader2 className="h-6 w-6 animate-spin text-(--accent)" />
				</div>
			) : error ? (
				<div className="py-4 text-center text-(--foreground-muted)">
					<p>Failed to load following list</p>
				</div>
			) : following.length === 0 ? (
				<div className="py-4 text-center text-(--foreground-muted)">
					<UserX className="mx-auto mb-2 h-8 w-8 opacity-50" />
					<p className="text-sm">You&apos;re not following anyone yet</p>
				</div>
			) : (
				<div className="space-y-3">
					{following.slice(0, 5).map((friend: SocialUserCardDto) => (
						<div key={friend.did} className="flex items-center gap-3">
							<UserAvatar
								src={friend.avatar}
								alt={String(friend.displayName) || friend.handle}
							/>
							<div className="min-w-0 flex-1">
								<p className="truncate font-medium text-sm">
									{String(friend.displayName) || friend.handle}
								</p>
								<p className="text-(--foreground-muted) text-xs">
									@{friend.handle}
								</p>
							</div>
							<button
								type="button"
								className="btn btn-secondary btn-sm h-8 px-2 text-xs"
								onClick={() => onUnfollow(friend.did)}
								disabled={isUnfollowPending}
								title="Unfollow"
							>
								{isUnfollowPending ? (
									<Loader2 className="h-3 w-3 animate-spin" />
								) : (
									<UserCheck className="h-3 w-3" />
								)}
							</button>
						</div>
					))}
				</div>
			)}
			{following.length > 5 && (
				<button
					type="button"
					className="mt-4 w-full text-center text-(--accent) text-sm hover:text-(--accent-hover)"
				>
					View all {following.length} following
				</button>
			)}
		</section>
	);
}
