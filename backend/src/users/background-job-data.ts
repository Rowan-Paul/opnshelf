export const TRAKT_IMPORT_JOB_TYPE = "trakt_import" as const;
export const ACCOUNT_DELETION_JOB_TYPE = "account_deletion" as const;

export type BackgroundJobType =
	| typeof TRAKT_IMPORT_JOB_TYPE
	| typeof ACCOUNT_DELETION_JOB_TYPE;

export type TraktImportJobData = {
	traktUsername: string;
	currentPage: number;
	totalPages: number | null;
	sourceCount: number;
	normalizedCount: number;
	importedCount: number;
	skippedCount: number;
	failedCount: number;
	profileUsername?: string;
	profileSlug?: string;
	profileName?: string;
	profileAvatarUrl?: string;
	rateLimitRetries?: number;
};

export type AccountDeletionJobData = {
	deletePdsData: boolean;
	totalRecords: number;
	deletedRecords: number;
	currentStep?: string;
	// Dynamic PDS-listed steps (list_items, lists) whose counts have already
	// been folded into totalRecords. Tracked so a resumed run doesn't double-add.
	countedDynamicSteps?: string[];
	// deletedRecords value at the moment the current step began. Lets a resumed
	// run recompute deletedRecords as stepBaseline + within-step progress instead
	// of double-counting records re-walked when the step restarts.
	stepBaseline?: number;
};

export function parseTraktImportData(json: unknown): TraktImportJobData {
	const data = json as Record<string, unknown>;
	return {
		traktUsername: String(data.traktUsername ?? ""),
		currentPage: Number(data.currentPage ?? 1),
		totalPages: data.totalPages != null ? Number(data.totalPages) : null,
		sourceCount: Number(data.sourceCount ?? 0),
		normalizedCount: Number(data.normalizedCount ?? 0),
		importedCount: Number(data.importedCount ?? 0),
		skippedCount: Number(data.skippedCount ?? 0),
		failedCount: Number(data.failedCount ?? 0),
		profileUsername: data.profileUsername
			? String(data.profileUsername)
			: undefined,
		profileSlug: data.profileSlug ? String(data.profileSlug) : undefined,
		profileName: data.profileName ? String(data.profileName) : undefined,
		profileAvatarUrl: data.profileAvatarUrl
			? String(data.profileAvatarUrl)
			: undefined,
		rateLimitRetries:
			data.rateLimitRetries != null ? Number(data.rateLimitRetries) : undefined,
	};
}

export function parseAccountDeletionData(
	json: unknown,
): AccountDeletionJobData {
	const data = json as Record<string, unknown>;
	return {
		deletePdsData: Boolean(data.deletePdsData ?? false),
		totalRecords: Number(data.totalRecords ?? 0),
		deletedRecords: Number(data.deletedRecords ?? 0),
		currentStep: data.currentStep ? String(data.currentStep) : undefined,
		countedDynamicSteps: Array.isArray(data.countedDynamicSteps)
			? data.countedDynamicSteps.map((step) => String(step))
			: undefined,
		stepBaseline:
			data.stepBaseline != null ? Number(data.stepBaseline) : undefined,
	};
}

export function buildTraktImportData(
	partial: Partial<TraktImportJobData> & { traktUsername: string },
): TraktImportJobData {
	return {
		currentPage: 1,
		totalPages: null,
		sourceCount: 0,
		normalizedCount: 0,
		importedCount: 0,
		skippedCount: 0,
		failedCount: 0,
		...partial,
	};
}

export function buildAccountDeletionData(
	partial: Partial<AccountDeletionJobData> & { deletePdsData: boolean },
): AccountDeletionJobData {
	return {
		totalRecords: 0,
		deletedRecords: 0,
		...partial,
	};
}
