import {
	socialControllerFollowMutation,
	socialControllerGetSuggestionsOptions,
	socialControllerSearchPeopleInfiniteOptions,
} from "@opnshelf/api";
import {
	keepPreviousData,
	useInfiniteQuery,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { ArrowRight, UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { UserAvatar } from "#/components/following/UserAvatar";
import { UserRowsSkeleton } from "#/components/skeletons";
import { useDebounce } from "#/hooks/useDebounce";
import { posthog } from "#/integrations/posthog/provider";

export function FollowSuggestionsStep({
	onNext,
	onFollowed,
}: {
	onNext: () => void;
	onFollowed: () => void;
}) {
	const queryClient = useQueryClient();
	const [query, setQuery] = useState("");
	const trimmedQuery = query.trim();
	const debouncedQuery = useDebounce(trimmedQuery, 350);
	const hasQuery = trimmedQuery.length > 0;
	const search = useInfiniteQuery({
		...socialControllerSearchPeopleInfiniteOptions({
			query: { q: debouncedQuery, pageSize: 20 },
		}),
		initialPageParam: 1,
		getNextPageParam: (lastPage) =>
			lastPage.hasNextPage ? lastPage.page + 1 : undefined,
		enabled: hasQuery && debouncedQuery.length > 0,
		placeholderData: keepPreviousData,
	});
	const suggested = useQuery({
		...socialControllerGetSuggestionsOptions(),
		enabled: !hasQuery,
	});
	const people = hasQuery
		? (search.data?.pages.flatMap((page) => page.items) ?? [])
		: (suggested.data?.items ?? []);
	const isLoading = hasQuery
		? search.isLoading ||
			(trimmedQuery !== debouncedQuery && people.length === 0)
		: suggested.isLoading;
	const error = hasQuery ? search.error : suggested.error;
	const retry = hasQuery ? search.refetch : suggested.refetch;

	const followMutation = useMutation({
		mutationKey: ["social", "follow"],
		...socialControllerFollowMutation(),
		onSuccess: () => {
			posthog.capture("user_followed", { source: "onboarding" });
			onFollowed();
			queryClient.invalidateQueries({
				queryKey: socialControllerGetSuggestionsOptions().queryKey,
			});
			queryClient.invalidateQueries({
				predicate: (query) =>
					(query.queryKey[0] as { _id?: string } | undefined)?._id ===
						"socialControllerGetFeed" ||
					(query.queryKey[0] as { _id?: string } | undefined)?._id ===
						"socialControllerSearchPeople",
			});
			toast.success("Followed");
		},
		onError: (error) => {
			toast.error(
				error instanceof Error ? error.message : "Failed to follow user",
			);
		},
	});

	return (
		<div className="card p-6">
			<div className="mb-6">
				<h2 className="text-display-3">People to Follow</h2>
				<p className="mt-1 text-(--foreground-muted) text-sm">
					Find people you know on Opnshelf
				</p>
			</div>

			<div className="mb-4 flex gap-2">
				<input
					type="search"
					aria-label="Search people"
					placeholder="Search people"
					className="input min-w-0 flex-1"
					value={query}
					onChange={(event) => setQuery(event.target.value)}
				/>
				{query.length > 0 && (
					<button
						type="button"
						className="btn btn-secondary"
						aria-label="Clear search"
						onClick={() => setQuery("")}
					>
						Clear
					</button>
				)}
			</div>
			{error && (
				<div role="alert" className="mb-4">
					<p>
						{hasQuery
							? "Couldn't search people."
							: "Couldn't load suggestions."}
					</p>
					<button
						type="button"
						className="btn btn-secondary mt-2"
						onClick={() => void retry()}
					>
						Try again
					</button>
				</div>
			)}

			{isLoading && people.length === 0 && <UserRowsSkeleton rows={4} />}

			{!isLoading && !error && people.length === 0 && (
				<p className="py-8 text-center text-(--foreground-muted) text-sm">
					{hasQuery
						? "No people found. Try another name or handle."
						: "No suggestions right now."}
				</p>
			)}

			{people.length > 0 && (
				<div className="mb-6 space-y-1">
					{people.map((person) => (
						<div
							key={person.did}
							className="flex items-center gap-3 rounded-lg p-2 hover:bg-(--background-subtle)"
						>
							<UserAvatar
								src={
									typeof person.avatar === "string" ? person.avatar : undefined
								}
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
								<span className="text-(--foreground-muted) text-xs">
									Following
								</span>
							) : (
								<button
									type="button"
									className="btn btn-primary btn-sm"
									onClick={() =>
										followMutation.mutate({
											path: { targetDid: person.did },
										})
									}
									disabled={
										followMutation.isPending &&
										followMutation.variables?.path?.targetDid === person.did
									}
								>
									{followMutation.isPending &&
									followMutation.variables?.path?.targetDid === person.did ? (
										"Following…"
									) : (
										<>
											<UserPlus className="size-3" />
											Follow
										</>
									)}
								</button>
							)}
						</div>
					))}
				</div>
			)}

			{hasQuery && search.isFetchingNextPage && <UserRowsSkeleton rows={3} />}
			{hasQuery && search.hasNextPage && (
				<button
					type="button"
					className="btn btn-secondary mb-4 w-full"
					disabled={
						search.isFetching ||
						search.isPlaceholderData ||
						trimmedQuery !== debouncedQuery
					}
					onClick={() => void search.fetchNextPage()}
				>
					{search.isFetchNextPageError ? "Retry loading more" : "Load more"}
				</button>
			)}
			<button type="button" onClick={onNext} className="btn btn-primary w-full">
				Continue
				<ArrowRight className="size-4" />
			</button>
		</div>
	);
}
