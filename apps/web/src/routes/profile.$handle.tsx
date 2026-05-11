import { usersControllerGetPublicProfileOptions } from "@opnshelf/api";
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
	Star,
	StickyNote,
	Users,
} from "lucide-react";
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
	const { profile } = Route.useLoaderData();
	const { user } = useAuth();
	const isOwner = user?.did === profile.did;

	return (
		<div className="container-app py-8">
			{/* Profile Header */}
			<div className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-center">
				{/* Avatar */}
				<div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-(--border) bg-(--background-elevated)">
					{profile.avatar ? (
						<img
							src={profile.avatar}
							alt={profile.displayName || profile.handle}
							className="h-full w-full object-cover"
						/>
					) : (
						<Users className="size-8 text-(--foreground-muted)" />
					)}
				</div>

				{/* Name & Handle */}
				<div className="flex-1">
					<div className="flex items-center gap-2">
						<h1 className="text-display-2">
							{profile.displayName || profile.handle}
						</h1>
						{isOwner && <span className="badge badge-subtle text-xs">You</span>}
					</div>
					<p className="text-(--foreground-muted)">@{profile.handle}</p>
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
