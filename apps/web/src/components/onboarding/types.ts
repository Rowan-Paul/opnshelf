export type TabValue = "trakt" | "csv";

export type ImportPhase =
	| "idle"
	| "fetching_trakt"
	| "parsing_csv"
	| "importing"
	| "done"
	| "error";

export type ImportProgressState = {
	phase: ImportPhase;
	totalItems: number;
	processedItems: number;
	currentBatch: number;
	totalBatches: number;
	imported: number;
	skipped: number;
	failed: number;
	startedAt: number | null;
	message: string;
};

export type OnboardingImportResult = {
	imported: number;
	skipped: number;
	failed: number;
	errors: string[];
};
