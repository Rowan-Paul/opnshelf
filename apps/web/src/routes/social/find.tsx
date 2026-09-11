import {
	socialControllerGetSuggestionsOptions,
	socialControllerSearchPeopleOptions,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { z } from "zod";
import { PeopleSearch } from "#/components/following/PeopleSearch";
import { useSocialFollowActions } from "#/components/following/useSocialFollowActions";
import { useDebounce } from "#/hooks/useDebounce";
import { useAuth } from "#/lib/auth-context";

const socialSearchSchema = z.object({ circleId: z.string().optional() });

export const Route = createFileRoute("/social/find")({
	validateSearch: socialSearchSchema,
	head: () => ({ meta: [{ title: "Find people | Opnshelf" }] }),
	component: FindPeoplePage,
});

function FindPeoplePage() {
	const { circleId } = Route.useSearch();
	const { user, isAuthenticated, isLoading: authLoading } = useAuth();
	const navigate = useNavigate();
	const [query, setQuery] = useState("");
	const debouncedQuery = useDebounce(query, 300);
	const { follow, unfollow, pendingFollowDid, pendingUnfollowDid } =
		useSocialFollowActions("social_find");

	useEffect(() => {
		if (!authLoading && !isAuthenticated) navigate({ to: "/login" });
	}, [authLoading, isAuthenticated, navigate]);

	const search = useQuery({
		...socialControllerSearchPeopleOptions({
			query: { q: debouncedQuery, pageSize: 10 },
		}),
		enabled: debouncedQuery.trim().length > 0,
	});
	const suggestions = useQuery({ ...socialControllerGetSuggestionsOptions() });

	return (
		<div className="container-app py-8">
			<Link
				to="/social"
				search={circleId ? { circleId } : {}}
				className="mb-4 inline-flex items-center gap-1 text-(--foreground-muted) text-sm hover:text-(--foreground)"
			>
				<ArrowLeft className="size-4" /> Social
			</Link>
			<div className="space-y-6">
				<div>
					<h1 className="font-bold font-display text-3xl">Find people</h1>
					<p className="text-(--foreground-muted)">
						Find people to follow and keep full lists on your Profile.
					</p>
				</div>
				<PeopleSearch
					query={query}
					onQueryChange={setQuery}
					isSearching
					onFocus={() => {}}
					onBlur={() => {}}
					results={search.data?.items ?? []}
					isLoading={search.isLoading}
					error={search.error}
					onRetry={() => search.refetch()}
					suggestions={suggestions.data?.items ?? []}
					isSuggestionsLoading={suggestions.isLoading}
					suggestionsError={suggestions.error}
					onRetrySuggestions={() => suggestions.refetch()}
					inline
					onFollow={follow}
					onUnfollow={unfollow}
					pendingFollowDid={pendingFollowDid}
					pendingUnfollowDid={pendingUnfollowDid}
				/>
				{user && (
					<div className="flex flex-wrap gap-2 border-(--border) border-t pt-6">
						<Link
							to="/profile/$handle/connections"
							params={{ handle: user.handle }}
							search={{ tab: "following" }}
							className="btn btn-secondary"
						>
							<Users className="mr-2 size-4" /> Following
						</Link>
						<Link
							to="/profile/$handle/connections"
							params={{ handle: user.handle }}
							search={{ tab: "followers" }}
							className="btn btn-secondary"
						>
							<Users className="mr-2 size-4" /> Followers
						</Link>
					</div>
				)}
			</div>
		</div>
	);
}
