import { usersControllerGetPublicProfileOptions } from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2, Users } from "lucide-react";
import { useState } from "react";
import { UserAvatar } from "#/components/following/UserAvatar";
import {
	usePublicFollowers,
	usePublicFollowing,
} from "#/lib/hooks/usePublicProfile";

export const Route = createFileRoute("/profile/$handle/connections")({
	component: ProfileConnectionsPage,
});

function ProfileConnectionsPage() {
	const { handle } = Route.useParams();
	const [activeTab, setActiveTab] = useState<"followers" | "following">(
		"followers",
	);

	const { data: profile } = useQuery({
		...usersControllerGetPublicProfileOptions({ path: { handle } }),
	});

	const followersQuery = usePublicFollowers(handle);
	const followingQuery = usePublicFollowing(handle);

	const activeQuery =
		activeTab === "followers" ? followersQuery : followingQuery;

	return (
		<div className="space-y-6">
			<h1 className="text-display-2">Connections</h1>

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
				<div className="flex h-64 items-center justify-center">
					<Loader2 className="size-8 animate-spin text-(--accent)" />
				</div>
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
				<div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{activeQuery.data.items.map((user) => (
						<Link
							key={user.did}
							to="/profile/$handle"
							params={{ handle: user.handle }}
							className="card card-interactive flex w-full items-center gap-4 p-4"
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
								<p className="text-(--foreground-muted) text-sm">
									@{user.handle}
								</p>
							</div>
						</Link>
					))}
				</div>
			)}
		</div>
	);
}
