import {
	socialControllerFollowMutation,
	socialControllerSearchPeopleOptions,
	socialControllerUnfollowMutation,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronRight, Loader2, Plus, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { PeopleSearch } from "#/components/following/PeopleSearch";
import { useDebounce } from "#/hooks/useDebounce";
import { useAuth } from "#/lib/auth-context";
import { useCircles, useCreateCircle } from "#/lib/hooks/useCircles";

export const Route = createFileRoute("/connections")({
	head: () => ({
		meta: [{ title: "Connections | OpnShelf" }],
	}),
	component: ConnectionsPage,
});

function ConnectionsPage() {
	const { isAuthenticated, isLoading: authLoading } = useAuth();
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	useEffect(() => {
		if (!authLoading && !isAuthenticated) {
			navigate({ to: "/login" });
		}
	}, [authLoading, isAuthenticated, navigate]);

	const [searchQuery, setSearchQuery] = useState("");
	const [isSearching, setIsSearching] = useState(false);
	const debouncedSearch = useDebounce(searchQuery, 300);

	const { data: circles = [] } = useCircles();
	const createCircle = useCreateCircle();
	const [newName, setNewName] = useState("");

	const { data: searchData, isLoading: searchLoading } = useQuery({
		...socialControllerSearchPeopleOptions({
			query: { q: debouncedSearch, pageSize: 10 },
		}),
		enabled: debouncedSearch.length > 0 && isSearching,
	});

	const invalidateSocial = useCallback(async () => {
		await queryClient.refetchQueries({
			predicate: (query) => {
				const id = (query.queryKey[0] as { _id?: string } | undefined)?._id;
				return (
					id === "socialControllerSearchPeople" ||
					id === "socialControllerGetFollowing"
				);
			},
		});
	}, [queryClient]);

	const followMutation = useMutation({
		mutationKey: ["social", "follow"],
		...socialControllerFollowMutation(),
		onSuccess: async () => {
			toast.success("Followed");
			await invalidateSocial();
		},
		onError: (error) =>
			toast.error(error instanceof Error ? error.message : "Failed to follow"),
	});

	const unfollowMutation = useMutation({
		mutationKey: ["social", "unfollow"],
		...socialControllerUnfollowMutation(),
		onSuccess: async () => {
			toast.success("Unfollowed");
			await invalidateSocial();
		},
		onError: (error) =>
			toast.error(
				error instanceof Error ? error.message : "Failed to unfollow",
			),
	});

	const handleFollow = useCallback(
		(targetDid: string) => followMutation.mutate({ path: { targetDid } }),
		[followMutation],
	);
	const handleUnfollow = useCallback(
		(targetDid: string) => unfollowMutation.mutate({ path: { targetDid } }),
		[unfollowMutation],
	);

	const handleCreate = () => {
		const name = newName.trim();
		if (!name) return;
		createCircle.mutate(
			{ body: { name } },
			{ onSuccess: () => setNewName("") },
		);
	};

	return (
		<div className="container-app py-8">
			<div className="mb-6">
				<h1 className="font-bold font-display text-3xl">Connections</h1>
				<p className="text-(--foreground-muted)">
					Find people to follow and organise them into circles
				</p>
			</div>

			<div className="mx-auto max-w-2xl space-y-8">
				<PeopleSearch
					query={searchQuery}
					onQueryChange={setSearchQuery}
					isSearching={isSearching}
					onFocus={() => setIsSearching(true)}
					onBlur={() => setTimeout(() => setIsSearching(false), 200)}
					results={searchData?.items || []}
					isLoading={searchLoading}
					onFollow={handleFollow}
					onUnfollow={handleUnfollow}
					pendingFollowDid={followMutation.variables?.path?.targetDid}
					pendingUnfollowDid={unfollowMutation.variables?.path?.targetDid}
				/>

				<section className="space-y-3">
					<div className="flex items-center gap-2">
						<Users className="size-5 text-(--accent)" />
						<h2 className="font-display font-semibold text-lg">Circles</h2>
					</div>

					<div className="flex gap-2">
						<input
							className="input flex-1"
							placeholder="New circle name"
							maxLength={50}
							value={newName}
							onChange={(event) => setNewName(event.target.value)}
							onKeyDown={(event) => {
								if (event.key === "Enter") handleCreate();
							}}
						/>
						<button
							type="button"
							className="btn btn-primary"
							onClick={handleCreate}
							disabled={!newName.trim() || createCircle.isPending}
						>
							{createCircle.isPending ? (
								<Loader2 className="size-4 animate-spin" />
							) : (
								<Plus className="size-4" />
							)}
						</button>
					</div>

					{circles.length === 0 ? (
						<p className="py-4 text-center text-(--foreground-muted) text-sm">
							No circles yet. Create one above, then add people to it.
						</p>
					) : (
						<div className="space-y-2">
							{circles.map((circle) => (
								<Link
									key={circle.id}
									to="/circles/$circleId"
									params={{ circleId: circle.id }}
									className="card flex items-center justify-between p-4 hover:opacity-80"
								>
									<div>
										<p className="font-medium">{circle.name}</p>
										<p className="text-(--foreground-muted) text-sm">
											{circle.memberCount}{" "}
											{circle.memberCount === 1 ? "person" : "people"}
										</p>
									</div>
									<ChevronRight className="size-5 text-(--foreground-muted)" />
								</Link>
							))}
						</div>
					)}
				</section>
			</div>
		</div>
	);
}
