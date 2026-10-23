export const ACCOUNT_DELETION_JOB_TYPE = "account_deletion" as const;
export type BackgroundJobType = typeof ACCOUNT_DELETION_JOB_TYPE;

export type AccountDeletionJobData = {
	deletePdsData: boolean;
	totalRecords: number;
	deletedRecords: number;
	currentStep?: string;
	// Dynamic PDS-listed steps whose counts have already
	// been folded into totalRecords. Tracked so a resumed run doesn't double-add.
	countedDynamicSteps?: string[];
	// Accumulated deletedRecords value at the start of the current worker tick.
	// Each bounded tick adds its successfully handled records to this baseline.
	stepBaseline?: number;
	// Last successfully processed key for steps backed by an immutable local
	// snapshot (currently managed blog mirrors). PDS-enumerated steps resume by
	// listing the records that still exist instead.
	stepCursor?: string;
};

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
		stepCursor: data.stepCursor ? String(data.stepCursor) : undefined,
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
