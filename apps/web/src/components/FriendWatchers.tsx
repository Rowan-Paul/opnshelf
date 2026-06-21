import { Link } from "@tanstack/react-router";
import { useWatchers } from "#/lib/hooks";
import { UserAvatar } from "./following/UserAvatar";

/**
 * Horizontal row of avatars for people the current user follows who have
 * watched this title. Renders nothing when there are none. Backed by
 * `socialControllerGetWatchers`. Mirrors the mobile `FriendWatchers` row, but
 * each avatar links to the watcher's profile.
 *
 * `mediaId` follows the scoped convention: a bare movie/show id, or a show id
 * with `:season:N` / `:season:N:episode:M` suffixes.
 */
export function FriendWatchers({
	mediaType,
	mediaId,
}: {
	mediaType: "movie" | "show";
	mediaId: string;
}) {
	const { data } = useWatchers(mediaType, mediaId);
	const watchers = data?.items ?? [];

	if (watchers.length === 0) return null;

	return (
		<section className="card w-full p-5">
			<h3 className="mb-4 font-display font-semibold">Watched by friends</h3>
			<div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
				{watchers.map(({ actor }) => {
					const name = actor.displayName || actor.handle;
					return (
						<Link
							key={actor.did}
							to="/profile/$handle"
							params={{ handle: actor.handle }}
							className="flex w-20 flex-shrink-0 flex-col items-center gap-1 hover:opacity-80"
							title={name}
						>
							<UserAvatar src={actor.avatar} alt={name} />
							<span className="line-clamp-2 w-full break-words text-center text-(--foreground-muted) text-xs">
								{name}
							</span>
						</Link>
					);
				})}
			</div>
		</section>
	);
}
