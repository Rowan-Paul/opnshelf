import * as SecureStore from "expo-secure-store";

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

export async function loadDismissedTraktImportJobIds(
	userDid: string,
): Promise<string[]> {
	try {
		const rawValue = await SecureStore.getItemAsync(getStorageKey(userDid));
		return parseStoredJobIds(rawValue);
	} catch (error) {
		console.error("Failed to load dismissed Trakt import jobs:", error);
		return [];
	}
}

export async function dismissTraktImportJob(
	userDid: string,
	jobId: string,
): Promise<string[]> {
	try {
		const nextJobIds = [
			jobId,
			...(await loadDismissedTraktImportJobIds(userDid)).filter(
				(storedJobId) => storedJobId !== jobId,
			),
		].slice(0, MAX_STORED_JOB_IDS);

		await SecureStore.setItemAsync(
			getStorageKey(userDid),
			JSON.stringify(nextJobIds),
		);

		return nextJobIds;
	} catch (error) {
		console.error("Failed to persist dismissed Trakt import job:", error);
		return [jobId];
	}
}

export async function clearDismissedTraktImportJobIds(userDid: string) {
	try {
		await SecureStore.deleteItemAsync(getStorageKey(userDid));
	} catch (error) {
		console.error("Failed to clear dismissed Trakt import jobs:", error);
	}
}
