const STORAGE_KEY_PREFIX = "opnshelf_trakt_import_dismissed_jobs:";
const MAX_STORED_JOB_IDS = 25;

function getStorageKey(userDid: string): string {
	return `${STORAGE_KEY_PREFIX}${userDid}`;
}

function parseStoredJobIds(rawValue: string | null): string[] {
	if (!rawValue) {
		return [];
	}

	try {
		const parsed = JSON.parse(rawValue) as unknown;
		if (!Array.isArray(parsed)) {
			return [];
		}

		return parsed.filter((value): value is string => typeof value === "string");
	} catch {
		return [];
	}
}

export function loadDismissedTraktImportJobIds(userDid: string): string[] {
	if (typeof window === "undefined") {
		return [];
	}

	return parseStoredJobIds(window.localStorage.getItem(getStorageKey(userDid)));
}

export function dismissTraktImportJob(
	userDid: string,
	jobId: string,
): string[] {
	if (typeof window === "undefined") {
		return [jobId];
	}

	const nextJobIds = [
		jobId,
		...loadDismissedTraktImportJobIds(userDid).filter(
			(storedJobId) => storedJobId !== jobId,
		),
	].slice(0, MAX_STORED_JOB_IDS);

	window.localStorage.setItem(
		getStorageKey(userDid),
		JSON.stringify(nextJobIds),
	);

	return nextJobIds;
}
