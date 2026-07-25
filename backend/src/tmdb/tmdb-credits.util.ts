export type TMDBCrewMember = {
	id: number;
	name: string;
	job?: string;
	department?: string;
	profile_path?: string;
};

/**
 * TMDB returns crew in arbitrary order, so anything that truncates the list
 * silently drops important people — Dune: Part Two listed its Director 17
 * entries in, behind a wall of producers.
 *
 * Nothing is dropped here: key jobs are hoisted to the front in keyJobs order
 * and everyone else keeps TMDB's own order behind them. Clients decide how many
 * to show, and the Director/Creator they look for is always near the top.
 */
export function sortCrewByJob<T extends TMDBCrewMember>(
	crew: T[] | undefined,
	keyJobs: string[],
): T[] {
	const rank = (member: T) => {
		const index = keyJobs.indexOf(member.job ?? "");
		return index === -1 ? keyJobs.length : index;
	};

	// Array#sort is stable, so equal ranks keep TMDB's ordering.
	return [...(crew ?? [])].sort((a, b) => rank(a) - rank(b));
}
