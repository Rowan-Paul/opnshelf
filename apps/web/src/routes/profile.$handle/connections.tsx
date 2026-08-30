import {
	socialControllerUnfollowMutation,
	usersControllerGetPublicFollowersQueryKey,
	usersControllerGetPublicFollowingQueryKey,
	usersControllerGetPublicProfileOptions,
	usersControllerGetPublicProfileQueryKey,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2, UserMinus, Users } from "lucide-react";
import { z } from "zod";
import { UserAvatar } from "#/components/following/UserAvatar";
import { UserRowsSkeleton } from "#/components/skeletons";
import { posthog } from "#/integrations/posthog/provider";
import { useAuth } from "#/lib/auth-context";
import {
	usePublicFollowers,
	usePublicFollowing,
} from "#/lib/hooks/usePublicProfile";

const connectionsSearchSchema = z.object({
	tab: z.enum(["followers", "following"]).optional().default("followers"),
});

export const Route = createFileRoute("/profile/$handle/connections")({
	loader: async ({ context, params }) => {
		try {
			const profile = await context.queryClient.ensureQueryData(
				usersControllerGetPublicProfileOptions({
					path: { handle: params.handle },
				}),
			);
			return { profile };
		} catch {
			return { profile: null };
		}
	},
	head: ({ loaderData }) => {
		const name =
			loaderData?.profile?.displayName || loaderData?.profile?.handle || "User";
		return {
			meta: [{ title: `${name}'s Connections | Opnshelf` }],
		};
	},
	component: ProfileConnectionsPage,
	validateSearch: connectionsSearchSchema,
});

function ProfileConnectionsPage() {
	const { handle } = Route.useParams();
	const { tab: activeTab } = Route.useSearch();
	const navigate = useNavigate();

	const setActiveTab = (tab: "followers" | "following") => {
		navigate({
			to: "/profile/$handle/connections",
			params: { handle },
			search: { tab },
			replace: true,
		});
	};

	const { data: profile } = useQuery({
		...usersControllerGetPublicProfileOptions({ path: { handle } }),
	});

	const { user } = useAuth();
	const isOwner = user?.did === profile?.did;
	const queryClient = useQueryClient();

	const profileQueryKey = usersControllerGetPublicProfileQueryKey({
		path: { handle },
	});
	const followersQueryKey = usersControllerGetPublicFollowersQueryKey({
		path: { handle },
	});
	const followingQueryKey = usersControllerGetPublicFollowingQueryKey({
		path: { handle },
	});

	const unfollowMutation = useMutation({
		mutationKey: ["social", "unfollow", handle],
		...socialControllerUnfollowMutation(),
		onSuccess: () => {
			posthog.capture("user_unfollowed", { source: "profile_connections" });
			queryClient.invalidateQueries({ queryKey: profileQueryKey });
			queryClient.invalidateQueries({ queryKey: followingQueryKey });
			queryClient.invalidateQueries({ queryKey: followersQueryKey });
		},
	});

	const followersQuery = usePublicFollowers(handle);
	const followingQuery = usePublicFollowing(handle);

	const activeQuery =
		activeTab === "followers" ? followersQuery : followingQuery;

	// Only the row whose unfollow is in flight should show a spinner — keying
	// off the shared mutation's `isPending` would spin every button at once.
	const pendingUnfollowDid = unfollowMutation.isPending
		? unfollowMutation.variables?.path?.targetDid
		: undefined;

	return (
		<div className="space-y-6">
			<h1 className="text-display-2">@{handle}</h1>

			{/* Sub-tabs */}
			<div className="flex gap-2 border-(--border) border-b">
				<button
					type="button"
					onClick={() => setActiveTab("followers")}
					className={`border-b-2 px-4 py-2 font-medium text-sm transition-colors ${
						activeTab === "followers"
							? "border-(--accent) text-(--accent)"
							: "border-transparent text-(--foreground-muted) hover:text-(--foreground)"
					}`}
				>
					Followers ({profile?.followersCount ?? 0})
				</button>
				<button
					type="button"
					onClick={() => setActiveTab("following")}
					className={`border-b-2 px-4 py-2 font-medium text-sm transition-colors ${
						activeTab === "following"
							? "border-(--accent) text-(--accent)"
							: "border-transparent text-(--foreground-muted) hover:text-(--foreground)"
					}`}
				>
					Following ({profile?.followingCount ?? 0})
				</button>
			</div>

			{/* Content */}
			{activeQuery.isLoading ? (
				<UserRowsSkeleton />
			) : !activeQuery.data || activeQuery.data.items.length === 0 ? (
				<div className="card p-8 text-center">
					<Users className="mx-auto mb-3 size-12 text-(--foreground-muted)" />
					<p className="text-(--foreground-muted)">
						{activeTab === "followers"
							? "No followers yet."
							: "Not following anyone yet."}
					</p>
				</div>
			) : (
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{activeQuery.data.items.map((user) => (
						<div
							key={user.did}
							className="card card-interactive flex w-full items-center gap-3 p-4"
						>
							<Link
								to="/profile/$handle"
								params={{ handle: user.handle }}
								className="flex min-w-0 flex-1 items-center gap-3"
							>
								<UserAvatar
									src={user.avatar}
									alt={String(user.displayName || user.handle)}
									size="lg"
								/>
								<div className="min-w-0 flex-1">
									<p className="truncate font-medium">
										{String(user.displayName || user.handle)}
									</p>
									<p className="truncate text-(--foreground-muted) text-sm">
										@{user.handle}
									</p>
								</div>
							</Link>
							{isOwner && user.isFollowing && (
								<button
									type="button"
									onClick={() =>
										unfollowMutation.mutate({
											path: { targetDid: user.did },
										})
									}
									disabled={pendingUnfollowDid === user.did}
									className="btn btn-secondary gap-2"
								>
									{pendingUnfollowDid === user.did ? (
										<Loader2 className="size-4 animate-spin" />
									) : (
										<UserMinus className="size-4" />
									)}
									Following
								</button>
							)}
						</div>
					))}
				</div>
			)}
		</div>
	);
}
