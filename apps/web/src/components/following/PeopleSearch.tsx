import type { SocialUserCardDto } from "@opnshelf/api";
import { Link } from "@tanstack/react-router";
import { Search, Sparkles, UserPlus } from "lucide-react";
import { UserRowsSkeleton } from "#/components/skeletons";
import { UserAvatar } from "./UserAvatar";

interface PeopleSearchProps {
	query: string;
	onQueryChange: (value: string) => void;
	isSearching: boolean;
	onFocus: () => void;
	onBlur: () => void;
	results: SocialUserCardDto[];
	isLoading: boolean;
	suggestions: SocialUserCardDto[];
	isSuggestionsLoading: boolean;
	error?: Error | null;
	suggestionsError?: Error | null;
	onRetry?: () => void;
	onRetrySuggestions?: () => void;
	inline?: boolean;
	onFollow: (did: string) => void;
	onUnfollow: (did: string) => void;
	pendingFollowDid?: string;
	pendingUnfollowDid?: string;
}

interface UserSearchRowProps {
	person: SocialUserCardDto;
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
	suggestions,
	isSuggestionsLoading,
	error,
	suggestionsError,
	onRetry,
	onRetrySuggestions,
	inline = false,
	onFollow,
	onUnfollow,
	pendingFollowDid,
	pendingUnfollowDid,
}: PeopleSearchProps) {
	return (
		<div className="relative">
			<div className="flex gap-3">
				<div className="relative flex-1">
					<Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-(--foreground-muted)" />
					<input
						type="text"
						placeholder="Find new people to follow"
						className="input pl-10!"
						value={query}
						onChange={(e) => onQueryChange(e.target.value)}
						onFocus={onFocus}
						onBlur={onBlur}
					/>
				</div>
			</div>

			{isSearching && (
				<div
					className={
						inline
							? "mt-3 rounded-lg border border-(--border) bg-(--background)"
							: "absolute top-full right-0 left-0 z-50 mt-2 max-h-80 overflow-y-auto rounded-lg border border-(--border) bg-(--background) shadow-lg"
					}
				>
					{query.trim().length === 0 ? (
						isSuggestionsLoading && suggestions.length === 0 ? (
							<div className="p-3">
								<UserRowsSkeleton rows={3} />
							</div>
						) : suggestionsError && suggestions.length === 0 ? (
							<PeopleLoadError
								message="Failed to load suggested people"
								onRetry={onRetrySuggestions}
							/>
						) : suggestions.length === 0 ? (
							<div className="p-4 text-center text-(--foreground-muted)">
								No recommendations right now
							</div>
						) : (
							<div className="space-y-1 p-2">
								<p className="flex items-center gap-2 px-2 py-1 font-medium text-(--foreground-muted) text-xs">
									<Sparkles className="size-3" /> Recommended for you
								</p>
								{suggestions.map((person) => (
									<UserSearchRow
										key={person.did}
										person={person}
										onFollow={onFollow}
										onUnfollow={onUnfollow}
										pendingFollowDid={pendingFollowDid}
										pendingUnfollowDid={pendingUnfollowDid}
									/>
								))}
							</div>
						)
					) : isLoading && results.length === 0 ? (
						<div className="p-3">
							<UserRowsSkeleton rows={3} />
						</div>
					) : error && results.length === 0 ? (
						<PeopleLoadError
							message="Failed to search people"
							onRetry={onRetry}
						/>
					) : results.length === 0 ? (
						<div className="p-4 text-center text-(--foreground-muted)">
							No users found
						</div>
					) : (
						<div className="space-y-1 p-2">
							{results.map((person: SocialUserCardDto) => (
								<UserSearchRow
									key={person.did}
									person={person}
									onFollow={onFollow}
									onUnfollow={onUnfollow}
									pendingFollowDid={pendingFollowDid}
									pendingUnfollowDid={pendingUnfollowDid}
								/>
							))}
						</div>
					)}
				</div>
			)}
		</div>
	);
}

function PeopleLoadError({
	message,
	onRetry,
}: {
	message: string;
	onRetry?: () => void;
}) {
	return (
		<div className="p-4 text-center text-(--foreground-muted)" role="alert">
			<p>{message}</p>
			{onRetry && (
				<button
					type="button"
					className="btn btn-secondary mt-3"
					onClick={onRetry}
				>
					Retry
				</button>
			)}
		</div>
	);
}

function UserSearchRow({
	person,
	onFollow,
	onUnfollow,
	pendingFollowDid,
	pendingUnfollowDid,
}: UserSearchRowProps) {
	return (
		<div className="flex items-center gap-3 rounded-lg p-2 hover:bg-(--background-subtle)">
			<Link
				to="/profile/$handle"
				params={{ handle: person.handle }}
				className="flex min-w-0 flex-1 items-center gap-3 hover:opacity-80"
			>
				<UserAvatar
					src={person.avatar}
					alt={String(person.displayName) || person.handle}
				/>
				<div className="min-w-0">
					<p className="truncate font-medium text-sm">
						{String(person.displayName) || person.handle}
					</p>
					<p className="text-(--foreground-muted) text-xs">@{person.handle}</p>
				</div>
			</Link>
			{person.isFollowing ? (
				<button
					type="button"
					className="btn btn-secondary btn-sm h-8 px-3 text-xs"
					onClick={() => onUnfollow(person.did)}
					disabled={pendingUnfollowDid === person.did}
				>
					{pendingUnfollowDid === person.did ? "Unfollowing…" : "Unfollow"}
				</button>
			) : (
				<button
					type="button"
					className="btn btn-primary btn-sm h-8 px-3 text-xs"
					onClick={() => onFollow(person.did)}
					disabled={pendingFollowDid === person.did}
				>
					{pendingFollowDid === person.did ? (
						"Following…"
					) : (
						<>
							<UserPlus className="mr-1 size-3" />
							Follow
						</>
					)}
				</button>
			)}
		</div>
	);
}
