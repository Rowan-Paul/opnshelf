export type TMDBCrewMember = {
	id: number;
	name: string;
	job?: string;
	department?: string;
	profile_path?: string;
};

export type TMDBCastMember = {
	id: number;
	name: string;
	character?: string;
	profile_path?: string;
	order: number;
};

/** What a detail page gets: a summary, plus the totals it can offer to expand. */
export interface TMDBCreditsSummary {
	cast: TMDBCastMember[];
	crew: TMDBCrewMember[];
	cast_total: number;
	crew_total: number;
}

/** What the expanded view gets: everyone, crew grouped by department. */
export interface TMDBFullCredits {
	cast: TMDBCastMember[];
	crew: Array<{ department: string; members: TMDBCrewMember[] }>;
}

/** Detail pages get a summary; the full credits live behind their own endpoint. */
export const SUMMARY_CAST_LIMIT = 20;
export const SUMMARY_CREW_LIMIT = 10;

/**
 * Department order for the full-credits view: what people came for first, TMDB's
 * "Crew" catch-all (drivers, PAs, stand-ins) last. Departments TMDB adds later
 * still show up, sorted after these.
 */
const DEPARTMENT_ORDER = [
	"Directing",
	"Writing",
	"Production",
	"Camera",
	"Editing",
	"Sound",
	"Music",
	"Art",
	"Costume & Make-Up",
	"Visual Effects",
	"Lighting",
	"Crew",
];

/** TMDB's catch-all department reads as a mistake next to the real ones. */
const DEPARTMENT_LABELS: Record<string, string> = { Crew: "Other crew" };

/**
 * TMDB sends adult, gender, credit_id, popularity and known_for_department on
 * every credit; none of it reaches a client. Dropping it here halves the full
 * credits payload for a big film (Inception: 203KB → 84KB).
 */
export function trimCast(cast: TMDBCastMember[] = []): TMDBCastMember[] {
	return cast.map(({ id, name, character, profile_path, order }) => ({
		id,
		name,
		character,
		profile_path,
		order,
	}));
}

export function trimCrew(crew: TMDBCrewMember[] = []): TMDBCrewMember[] {
	return crew.map(({ id, name, job, department, profile_path }) => ({
		id,
		name,
		job,
		department,
		profile_path,
	}));
}

/**
 * TMDB returns crew in arbitrary order, so anything that truncates the list
 * silently drops important people — Dune: Part Two listed its Director 17
 * entries in, behind a wall of producers.
 *
 * Nothing is dropped here: key jobs are hoisted to the front in keyJobs order
 * and everyone else keeps TMDB's own order behind them.
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

/**
 * The crew a detail page shows without being asked: key jobs only, each person
 * once (their highest-ranked job), capped. Callers pair this with a crew total
 * so the UI can offer the full list rather than quietly ending here.
 */
export function summarizeCrew<T extends TMDBCrewMember>(
	crew: T[] | undefined,
	keyJobs: string[],
): T[] {
	const ranked = sortCrewByJob(crew, keyJobs).filter((member) =>
		keyJobs.includes(member.job ?? ""),
	);

	const seen = new Set<number>();
	return ranked
		.filter((member) => {
			if (seen.has(member.id)) return false;
			seen.add(member.id);
			return true;
		})
		.slice(0, SUMMARY_CREW_LIMIT);
}

/**
 * Groups the full crew by department for the expanded view — 736 flat rows
 * (Inception) is a credits scroll, not a list anyone can read.
 */
export function groupCrewByDepartment<T extends TMDBCrewMember>(
	crew: T[] | undefined,
): Array<{ department: string; members: T[] }> {
	const groups = new Map<string, T[]>();
	for (const member of crew ?? []) {
		const department = member.department || "Crew";
		groups.set(department, [...(groups.get(department) ?? []), member]);
	}

	const rank = (department: string) => {
		const index = DEPARTMENT_ORDER.indexOf(department);
		return index === -1 ? DEPARTMENT_ORDER.length : index;
	};

	return [...groups.entries()]
		.sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
		.map(([department, members]) => ({
			department: DEPARTMENT_LABELS[department] ?? department,
			members,
		}));
}
