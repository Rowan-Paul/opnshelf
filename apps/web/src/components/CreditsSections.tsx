import type { TmdbCastDto, TmdbCreditsDto, TmdbCrewDto } from "@opnshelf/api";
import {
	moviesControllerGetFullMovieCreditsOptions,
	showsControllerGetFullShowCreditsOptions,
} from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
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
 * The cast and crew a detail page shows without being asked, with a link to the
 * full credits. The totals come from the API, so the link states what is behind
 * it instead of quietly ending the list.
 */
export function CreditsSummary({
	credits,
	creditsTo,
	creditsParams,
}: {
	credits?: TmdbCreditsDto;
	creditsTo: string;
	creditsParams: Record<string, string>;
}) {
	const castTotal = credits?.cast_total ?? credits?.cast?.length ?? 0;
	const crewTotal = credits?.crew_total ?? credits?.crew?.length ?? 0;
	const hasMore =
		castTotal > (credits?.cast?.length ?? 0) ||
		crewTotal > (credits?.crew?.length ?? 0);

	return (
		<div className="space-y-8">
			<PersonGrid people={castToPeople(credits?.cast)} />
			<PersonGrid
				people={crewToPeople(credits?.crew)}
				title="Crew"
				emptyMessage="No crew information available."
			/>
			{hasMore && (
				<Link
					to={creditsTo}
					params={creditsParams}
					className="inline-block text-(--foreground-muted) text-sm hover:text-(--foreground)"
				>
					{`Full cast & crew · ${castTotal} cast, ${crewTotal} crew`}
				</Link>
			)}
		</div>
	);
}

/**
 * Every credit, crew grouped by department — a movie can credit 700+ people and
 * a flat list of those is a credits scroll, not something anyone can read.
 * Rendered on its own page rather than in a dialog: it is deep-linkable, the
 * back button behaves, and there is no scroll trapped inside a scroll.
 */
export function FullCredits({
	mediaType,
	mediaId,
}: {
	mediaType: "movie" | "show";
	mediaId: string;
}) {
	// Two queries rather than one with a ternary: the generated options carry
	// different query-key types, which defeats useQuery's inference.
	const movieQuery = useQuery({
		...moviesControllerGetFullMovieCreditsOptions({
			path: { movieId: mediaId },
		}),
		enabled: mediaType === "movie",
	});
	const showQuery = useQuery({
		...showsControllerGetFullShowCreditsOptions({ path: { showId: mediaId } }),
		enabled: mediaType === "show",
	});
	const { data, isPending, isError } =
		mediaType === "movie" ? movieQuery : showQuery;

	if (isError) {
		return (
			<p className="text-(--foreground-muted) text-sm">
				Couldn't load the credits.
			</p>
		);
	}

	if (isPending || !data) {
		return (
			<div className="space-y-8">
				<section>
					<h2 className="mb-4 text-display-3">Cast</h2>
					<UserRowsSkeleton rows={6} />
				</section>
				<section>
					<h2 className="mb-4 text-display-3">Crew</h2>
					<UserRowsSkeleton rows={6} />
				</section>
			</div>
		);
	}

	return (
		<div className="space-y-8">
			<PersonGrid
				people={castToPeople(data.cast)}
				initialCount={data.cast.length}
				emptyMessage="No cast information available."
			/>
			{data.crew.map((department) => (
				<PersonGrid
					key={department.department}
					people={crewToPeople(department.members)}
					title={department.department}
					initialCount={department.members.length}
				/>
			))}
		</div>
	);
}
