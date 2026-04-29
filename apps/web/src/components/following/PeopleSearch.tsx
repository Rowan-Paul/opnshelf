import type { SocialUserCardDto } from "@opnshelf/api";
import { Loader2, Search, UserPlus } from "lucide-react";
import { UserAvatar } from "./UserAvatar";

interface PeopleSearchProps {
	query: string;
	onQueryChange: (value: string) => void;
	isSearching: boolean;
	onFocus: () => void;
	onBlur: () => void;
	results: SocialUserCardDto[];
	isLoading: boolean;
	onFollow: (did: string) => void;
	onUnfollow: (did: string) => void;
	pendingFollowDid?: string;
	pendingUnfollowDid?: string;
}

export function PeopleSearch({
	query,
	onQueryChange,
	isSearching,
	onFocus,
	onBlur,
	results,
	isLoading,
	onFollow,
	onUnfollow,
	pendingFollowDid,
	pendingUnfollowDid,
}: PeopleSearchProps) {
	return (
		<div className="relative">
			<div className="flex gap-3">
				<div className="relative flex-1">
					<Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-(--foreground-muted)" />
					<input
						type="text"
						placeholder="Find people to follow..."
						className="input pl-10!"
						value={query}
						onChange={(e) => onQueryChange(e.target.value)}
						onFocus={onFocus}
						onBlur={onBlur}
					/>
					{isLoading && (
						<Loader2 className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 animate-spin text-(--foreground-muted)" />
					)}
				</div>
			</div>

			{isSearching && query.length > 0 && (
				<div className="absolute top-full right-0 left-0 z-50 mt-2 max-h-80 overflow-y-auto rounded-lg border border-(--border) bg-(--background) shadow-lg">
					{results.length === 0 ? (
						<div className="p-4 text-center text-(--foreground-muted)">
							{isLoading ? "Searching..." : "No users found"}
						</div>
					) : (
						<div className="space-y-1 p-2">
							{results.map((person: SocialUserCardDto) => (
								<div
									key={person.did}
									className="flex items-center gap-3 rounded-lg p-2 hover:bg-(--background-subtle)"
								>
									<UserAvatar
										src={person.avatar}
										alt={String(person.displayName) || person.handle}
									/>
									<div className="min-w-0 flex-1">
										<p className="truncate font-medium text-sm">
											{String(person.displayName) || person.handle}
										</p>
										<p className="text-(--foreground-muted) text-xs">
											@{person.handle}
										</p>
									</div>
									{person.isFollowing ? (
										<button
											type="button"
											className="btn btn-secondary btn-sm h-8 px-3 text-xs"
											onClick={() => onUnfollow(person.did)}
											disabled={pendingUnfollowDid === person.did}
										>
											{pendingUnfollowDid === person.did ? (
												<Loader2 className="h-3 w-3 animate-spin" />
											) : (
												"Unfollow"
											)}
										</button>
									) : (
										<button
											type="button"
											className="btn btn-primary btn-sm h-8 px-3 text-xs"
											onClick={() => onFollow(person.did)}
											disabled={pendingFollowDid === person.did}
										>
											{pendingFollowDid === person.did ? (
												<Loader2 className="h-3 w-3 animate-spin" />
											) : (
												<>
													<UserPlus className="mr-1 h-3 w-3" />
													Follow
												</>
											)}
										</button>
									)}
								</div>
							))}
						</div>
					)}
				</div>
			)}
		</div>
	);
}
