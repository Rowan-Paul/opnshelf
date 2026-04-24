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
			<h3 className="font-display font-semibold mb-4">
				Following ({following.length})
			</h3>
			{isLoading ? (
				<div className="flex items-center justify-center py-4">
					<Loader2 className="h-6 w-6 animate-spin text-[var(--accent)]" />
				</div>
			) : error ? (
				<div className="text-center text-[var(--foreground-muted)] py-4">
					<p>Failed to load following list</p>
				</div>
			) : following.length === 0 ? (
				<div className="text-center text-[var(--foreground-muted)] py-4">
					<UserX className="h-8 w-8 mx-auto mb-2 opacity-50" />
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
							<div className="flex-1 min-w-0">
								<p className="font-medium text-sm truncate">
									{String(friend.displayName) || friend.handle}
								</p>
								<p className="text-xs text-[var(--foreground-muted)]">
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
					className="mt-4 w-full text-center text-sm text-[var(--accent)] hover:text-[var(--accent-hover)]"
				>
					View all {following.length} following
				</button>
			)}
		</section>
	);
}
