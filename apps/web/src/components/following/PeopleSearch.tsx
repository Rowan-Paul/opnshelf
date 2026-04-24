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
	isFollowPending: boolean;
	isUnfollowPending: boolean;
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
	isFollowPending,
	isUnfollowPending,
}: PeopleSearchProps) {
	return (
		<div className="relative">
			<div className="flex gap-3">
				<div className="relative flex-1">
					<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--foreground-muted)]" />
					<input
						type="text"
						placeholder="Find people to follow..."
						className="input !pl-10"
						value={query}
						onChange={(e) => onQueryChange(e.target.value)}
						onFocus={onFocus}
						onBlur={onBlur}
					/>
					{isLoading && (
						<Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[var(--foreground-muted)]" />
					)}
				</div>
			</div>

			{isSearching && query.length > 0 && (
				<div className="absolute top-full left-0 right-0 mt-2 bg-[var(--background)] border border-[var(--border)] rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
					{results.length === 0 ? (
						<div className="p-4 text-center text-[var(--foreground-muted)]">
							{isLoading ? "Searching..." : "No users found"}
						</div>
					) : (
						<div className="p-2 space-y-1">
							{results.map((person: SocialUserCardDto) => (
								<div
									key={person.did}
									className="flex items-center gap-3 p-2 hover:bg-[var(--background-subtle)] rounded-lg"
								>
									<UserAvatar
										src={person.avatar}
										alt={String(person.displayName) || person.handle}
									/>
									<div className="flex-1 min-w-0">
										<p className="font-medium text-sm truncate">
											{String(person.displayName) || person.handle}
										</p>
										<p className="text-xs text-[var(--foreground-muted)]">
											@{person.handle}
										</p>
									</div>
									{person.isFollowing ? (
										<button
											type="button"
											className="btn btn-secondary btn-sm h-8 px-3 text-xs"
											onClick={() => onUnfollow(person.did)}
											disabled={isUnfollowPending}
										>
											{isUnfollowPending ? (
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
											disabled={isFollowPending}
										>
											{isFollowPending ? (
												<Loader2 className="h-3 w-3 animate-spin" />
											) : (
												<>
													<UserPlus className="h-3 w-3 mr-1" />
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
