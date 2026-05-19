import {
	socialControllerFollowMutation,
	socialControllerGetRelationshipOptions,
	socialControllerUnfollowMutation,
	usersControllerGetPublicProfileOptions,
	usersControllerGetPublicProfileQueryKey,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	createFileRoute,
	Link,
	notFound,
	Outlet,
	useParams,
} from "@tanstack/react-router";
import {
	Clock,
	Film,
	LayoutGrid,
	List,
	Loader2,
	Star,
	StickyNote,
	UserCheck,
	UserPlus,
	Users,
} from "lucide-react";
import { UserAvatar } from "#/components/following/UserAvatar";
import { useAuth } from "#/lib/auth-context";

export const Route = createFileRoute("/profile/$handle")({
	loader: async ({ context, params }) => {
		try {
			const profile = await context.queryClient.ensureQueryData(
				usersControllerGetPublicProfileOptions({
					path: { handle: params.handle },
				}),
			);
			return { profile };
		} catch (error) {
			if (
				typeof error === "object" &&
				error !== null &&
				("status" in error || "statusCode" in error) &&
				((error as Record<string, unknown>).status === 404 ||
					(error as Record<string, unknown>).statusCode === 404)
			) {
				throw notFound();
			}
			throw error;
		}
	},
	head: ({ loaderData }) => {
		const name =
			loaderData?.profile.displayName || loaderData?.profile.handle || "User";
		return {
			meta: [
				{ title: `${name} | OpnShelf` },
				{
					name: "description",
					content: `View ${name}'s shelf, lists, and activity on OpnShelf.`,
				},
			],
		};
	},
	component: ProfileLayout,
});

const tabs = [
	{ label: "Overview", to: "/profile/$handle", icon: LayoutGrid, exact: true },
	{ label: "Shelf", to: "/profile/$handle/shelf", icon: Film },
	{ label: "Up Next", to: "/profile/$handle/up-next", icon: Clock },
	{ label: "Lists", to: "/profile/$handle/lists", icon: List },
	{ label: "Notes", to: "/profile/$handle/notes", icon: StickyNote },
	{ label: "Reviews", to: "/profile/$handle/reviews", icon: Star },
	{ label: "Connections", to: "/profile/$handle/connections", icon: Users },
];

function ProfileLayout() {
	const { handle } = useParams({ from: "/profile/$handle" });
	const { profile: loaderProfile } = Route.useLoaderData();
	const { user, isAuthenticated } = useAuth();
	const queryClient = useQueryClient();

	const { data: liveProfile } = useQuery({
		...usersControllerGetPublicProfileOptions({ path: { handle } }),
	});
	const profile = liveProfile ?? loaderProfile;

	const isOwner = user?.did === profile.did;

	const { data: relationship } = useQuery({
		...socialControllerGetRelationshipOptions({
			path: { targetDid: profile.did },
		}),
		enabled: isAuthenticated && !isOwner,
	});

	const relationshipQueryKey = socialControllerGetRelationshipOptions({
		path: { targetDid: profile.did },
	}).queryKey;

	const profileQueryKey = usersControllerGetPublicProfileQueryKey({
		path: { handle },
	});

	const followMutation = useMutation({
		...socialControllerFollowMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: relationshipQueryKey });
			queryClient.invalidateQueries({ queryKey: profileQueryKey });
		},
	});

	const unfollowMutation = useMutation({
		...socialControllerUnfollowMutation(),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: relationshipQueryKey });
			queryClient.invalidateQueries({ queryKey: profileQueryKey });
		},
	});

	const isPending = followMutation.isPending || unfollowMutation.isPending;

	return (
		<div className="container-app py-8">
			{/* Profile Header */}
			<div className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-center">
				{/* Avatar */}
				<div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-(--border) bg-(--background-elevated)">
					<UserAvatar
						src={profile.avatar}
						alt={profile.displayName || profile.handle}
						className="h-full w-full rounded-full"
					/>
				</div>

				{/* Name, Handle & Follow */}
				<div className="flex-1">
					<div className="flex items-center gap-2">
						<h1 className="text-display-2">
							{profile.displayName || profile.handle}
						</h1>
						{isOwner && <span className="badge badge-subtle text-xs">You</span>}
					</div>
					<p className="text-(--foreground-muted)">@{profile.handle}</p>

					{/* Social Links */}
					{(profile.blueskyProfileUrl || profile.tangledProfileUrl) && (
						<div className="mt-2 flex items-center gap-3">
							{profile.blueskyProfileUrl && profile.showBlueskyOnProfile && (
								<a
									href={profile.blueskyProfileUrl}
									target="_blank"
									rel="noopener noreferrer"
									className="inline-flex items-center gap-1.5 rounded-md bg-(--background-subtle) px-2 py-1 text-(--foreground-muted) text-xs transition-colors hover:bg-(--background-elevated) hover:text-(--foreground)"
								>
									<img src="/bluesky.svg" alt="Bluesky" className="size-3.5" />
									Bluesky
								</a>
							)}
							{profile.tangledProfileUrl && profile.showTangledOnProfile && (
								<a
									href={profile.tangledProfileUrl}
									target="_blank"
									rel="noopener noreferrer"
									className="inline-flex items-center gap-1.5 rounded-md bg-(--background-subtle) px-2 py-1 text-(--foreground-muted) text-xs transition-colors hover:bg-(--background-elevated) hover:text-(--foreground)"
								>
									<div className="relative size-3.5">
										<img
											src="/tangled-black.svg"
											alt="Tangled"
											className="absolute inset-0 block h-full w-full object-contain dark:hidden"
										/>
										<img
											src="/tangled-white.svg"
											alt="Tangled"
											className="absolute inset-0 hidden h-full w-full object-contain dark:block"
										/>
									</div>
									Tangled
								</a>
							)}
						</div>
					)}

					{isAuthenticated && !isOwner && relationship?.canFollow && (
						<div className="mt-3">
							{relationship.isFollowing ? (
								<button
									type="button"
									onClick={() =>
										unfollowMutation.mutate({
											path: { targetDid: profile.did },
										})
									}
									disabled={isPending}
									className="btn btn-secondary gap-2"
								>
									{isPending ? (
										<Loader2 className="size-4 animate-spin" />
									) : (
										<UserCheck className="size-4" />
									)}
									Following
								</button>
							) : (
								<button
									type="button"
									onClick={() =>
										followMutation.mutate({
											path: { targetDid: profile.did },
										})
									}
									disabled={isPending}
									className="btn btn-primary gap-2"
								>
									{isPending ? (
										<Loader2 className="size-4 animate-spin" />
									) : (
										<UserPlus className="size-4" />
									)}
									Follow
								</button>
							)}
						</div>
					)}
				</div>

				{/* Stats */}
				<div className="flex gap-6">
					<div className="text-center">
						<p className="font-semibold text-lg">{profile.followersCount}</p>
						<p className="text-(--foreground-muted) text-sm">Followers</p>
					</div>
					<div className="text-center">
						<p className="font-semibold text-lg">{profile.followingCount}</p>
						<p className="text-(--foreground-muted) text-sm">Following</p>
					</div>
				</div>
			</div>

			{/* Tab Navigation */}
			<div className="mb-8 border-(--border) border-b">
				<nav className="flex gap-1 overflow-x-auto">
					{tabs.map((tab) => {
						const Icon = tab.icon;
						return (
							<Link
								key={tab.label}
								to={tab.to}
								params={{ handle }}
								activeOptions={tab.exact ? { exact: true } : undefined}
								activeProps={{
									className: "border-(--accent) text-(--accent)",
								}}
								inactiveProps={{
									className:
										"border-transparent text-(--foreground-muted) hover:text-(--foreground) hover:border-(--border-strong)",
								}}
								className="flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 font-medium text-sm transition-colors"
							>
								<Icon className="h-4 w-4" />
								{tab.label}
							</Link>
						);
					})}
				</nav>
			</div>

			{/* Child Route Content */}
			<Outlet />
		</div>
	);
}
