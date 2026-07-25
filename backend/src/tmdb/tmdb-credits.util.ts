export type TMDBCrewMember = {
	id: number;
	name: string;
	job?: string;
	department?: string;
	profile_path?: string;
};

const CREW_LIMIT = 10;
const PER_JOB_LIMIT = 2;

/**
 * TMDB returns crew in arbitrary order and credits the same person several
 * times, so filtering on key jobs and slicing can drop the Director in favour
 * of ten producers (Dune: Part Two had the Director at index 17).
 *
 * Rank by keyJobs order, keep each person's highest-ranked job only, and cap
 * how many people share a job so the list stays varied.
 */
export function pickKeyCrew<T extends TMDBCrewMember>(
	crew: T[] | undefined,
	keyJobs: string[],
): T[] {
	const ranked = (crew ?? [])
		.filter((member) => keyJobs.includes(member.job ?? ""))
		.sort(
			(a, b) => keyJobs.indexOf(a.job ?? "") - keyJobs.indexOf(b.job ?? ""),
		);

	const seenPeople = new Set<number>();
	const jobCounts = new Map<string, number>();
	const picked: T[] = [];

	for (const member of ranked) {
		const job = member.job ?? "";
		const jobCount = jobCounts.get(job) ?? 0;
		if (seenPeople.has(member.id) || jobCount >= PER_JOB_LIMIT) continue;

		seenPeople.add(member.id);
		jobCounts.set(job, jobCount + 1);
		picked.push(member);
		if (picked.length >= CREW_LIMIT) break;
	}

	return picked;
}
