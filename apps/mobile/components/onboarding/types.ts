import type { StartTraktImportResponseDto } from "@opnshelf/api";

export type TabValue = "trakt" | "csv";

export type ImportPhase =
	| "idle"
	| "fetching_trakt"
	| "parsing_csv"
	| "preview_ready"
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

export type FollowImportStatus = "idle" | "running" | "success" | "error";

export type FollowImportResult = {
	matchedCount: number;
	createdCount: number;
	alreadyFollowingCount: number;
};

export type TraktImportPreview = StartTraktImportResponseDto;
