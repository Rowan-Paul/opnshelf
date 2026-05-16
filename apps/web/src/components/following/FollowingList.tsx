import type { SocialUserCardDto } from "@opnshelf/api";
import { Link } from "@tanstack/react-router";
import { Loader2, UserCheck, UserX } from "lucide-react";
import { UserAvatar } from "./UserAvatar";

interface FollowingListProps {
	following: SocialUserCardDto[];
	isLoading: boolean;
	error: Error | null;
	onUnfollow: (did: string) => void;
	pendingUnfollowDid?: string;
}

export function FollowingList({
	following,
	isLoading,
	error,
	onUnfollow,
	pendingUnfollowDid,
}: FollowingListProps) {
	return (
		<section className="card w-full p-5">
			<h3 className="mb-4 font-display font-semibold">
				Following ({following.length})
			</h3>
			{isLoading ? (
				<div className="flex items-center justify-center py-4">
					<Loader2 className="size-6 animate-spin text-(--accent)" />
				</div>
			) : error ? (
				<div className="py-4 text-center text-(--foreground-muted)">
					<p>Failed to load following list</p>
				</div>
			) : following.length === 0 ? (
				<div className="py-4 text-center text-(--foreground-muted)">
					<UserX className="mx-auto mb-2 size-8 opacity-50" />
					<p className="text-sm">You&apos;re not following anyone yet</p>
				</div>
			) : (
				<div className="space-y-3">
					{following.slice(0, 5).map((friend: SocialUserCardDto) => (
						<div key={friend.did} className="flex items-center gap-3">
							<Link
								to="/profile/$handle"
								params={{ handle: friend.handle }}
								className="flex min-w-0 flex-1 items-center gap-3 hover:opacity-80"
							>
								<UserAvatar
									src={friend.avatar}
									alt={String(friend.displayName) || friend.handle}
								/>
								<div className="min-w-0">
									<p className="truncate font-medium text-sm">
										{String(friend.displayName) || friend.handle}
									</p>
									<p className="truncate text-(--foreground-muted) text-xs">
										@{friend.handle}
									</p>
								</div>
							</Link>
							<button
								type="button"
								className="btn btn-secondary btn-sm h-8 px-2 text-xs"
								onClick={() => onUnfollow(friend.did)}
								disabled={pendingUnfollowDid === friend.did}
								title="Unfollow"
							>
								{pendingUnfollowDid === friend.did ? (
									<Loader2 className="size-3 animate-spin" />
								) : (
									<UserCheck className="size-3" />
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
