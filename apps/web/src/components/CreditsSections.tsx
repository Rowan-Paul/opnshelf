import type { TmdbCastDto, TmdbCreditsDto, TmdbCrewDto } from "@opnshelf/api";
import {
	moviesControllerGetFullMovieCreditsOptions,
	showsControllerGetFullShowCreditsOptions,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import PersonGrid from "#/components/PersonGrid";
import { UserRowsSkeleton } from "#/components/skeletons";

const photo = (path?: string) =>
	path ? `https://image.tmdb.org/t/p/w185${path}` : undefined;

const castToPeople = (cast: TmdbCastDto[] = []) =>
	cast.map((actor) => ({
		id: actor.id,
		name: actor.name,
		role: actor.character || "",
		photo: photo(actor.profile_path),
	}));

const crewToPeople = (crew: TmdbCrewDto[] = []) =>
	crew.map((person) => ({
		id: person.id,
		name: person.name,
		role: person.job || "",
		photo: photo(person.profile_path),
	}));

/**
 * Cast and crew for a detail page. Collapsed it shows the summary the detail
 * response already carries; expanded it fetches the full credits and groups the
 * crew by department, because a movie can credit 700+ people and a flat list of
 * those is a credits scroll, not something anyone can read.
 */
export default function CreditsSections({
	mediaType,
	mediaId,
	credits,
}: {
	mediaType: "movie" | "show";
	mediaId: string;
	credits?: TmdbCreditsDto;
}) {
	const [expanded, setExpanded] = useState(false);

	// Two gated queries rather than one with a ternary: the generated options
	// carry different query-key types, which defeats useQuery's inference.
	const movieQuery = useQuery({
		...moviesControllerGetFullMovieCreditsOptions({
			path: { movieId: mediaId },
		}),
		enabled: expanded && mediaType === "movie",
	});
	const showQuery = useQuery({
		...showsControllerGetFullShowCreditsOptions({ path: { showId: mediaId } }),
		enabled: expanded && mediaType === "show",
	});
	const { data, isPending } = mediaType === "movie" ? movieQuery : showQuery;

	const castTotal = credits?.cast_total ?? credits?.cast?.length ?? 0;
	const crewTotal = credits?.crew_total ?? credits?.crew?.length ?? 0;
	const hasMore =
		castTotal > (credits?.cast?.length ?? 0) ||
		crewTotal > (credits?.crew?.length ?? 0);

	if (!expanded) {
		return (
			<div className="space-y-8">
				<PersonGrid people={castToPeople(credits?.cast)} />
				<PersonGrid
					people={crewToPeople(credits?.crew)}
					title="Crew"
					emptyMessage="No crew information available."
				/>
				{hasMore && (
					<button
						type="button"
						onClick={() => setExpanded(true)}
						className="text-(--foreground-muted) text-sm hover:text-(--foreground)"
					>
						{`Show all credits · ${castTotal} cast, ${crewTotal} crew`}
					</button>
				)}
			</div>
		);
	}

	return (
		<div className="space-y-8">
			{isPending || !data ? (
				<>
					<PersonGrid people={castToPeople(credits?.cast)} />
					<section>
						<h2 className="mb-4 text-display-3">Crew</h2>
						<UserRowsSkeleton rows={6} />
					</section>
				</>
			) : (
				<>
					<PersonGrid people={castToPeople(data.cast)} />
					{data.crew.map((department) => (
						<PersonGrid
							key={department.department}
							people={crewToPeople(department.members)}
							title={department.department}
						/>
					))}
				</>
			)}
			<button
				type="button"
				onClick={() => setExpanded(false)}
				className="text-(--foreground-muted) text-sm hover:text-(--foreground)"
			>
				Show less
			</button>
		</div>
	);
}
