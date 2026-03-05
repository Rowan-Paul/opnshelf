import type { NormalizedImportItemDto } from "@opnshelf/api";
import Papa from "papaparse";

export type CsvParseError = { row: number; message: string };

export type ImportProgressUpdate = {
	totalItems: number;
	processedItems: number;
	currentBatch: number;
	totalBatches: number;
	imported: number;
	skipped: number;
	failed: number;
};

const MAX_BATCH_SIZE = 25;
const CSV_HEADERS = [
	"watched_at",
	"action",
	"type",
	"tmdb_id",
	"season_number",
	"episode_number",
] as const;

export async function runImportInChunks(
	items: NormalizedImportItemDto[],
	importMutate: (payload: {
		body: { items: NormalizedImportItemDto[] };
	}) => Promise<{
		imported: number;
		skipped: number;
		failed: number;
		errors: Array<{ message: string }>;
	}>,
	onProgress?: (update: ImportProgressUpdate) => void,
) {
	let imported = 0;
	let skipped = 0;
	let failed = 0;
	const errors: string[] = [];
	const totalItems = items.length;
	const totalBatches = Math.ceil(totalItems / MAX_BATCH_SIZE);

	onProgress?.({
		totalItems,
		processedItems: 0,
		currentBatch: 0,
		totalBatches,
		imported,
		skipped,
		failed,
	});

	for (let start = 0; start < totalItems; start += MAX_BATCH_SIZE) {
		const currentBatch = Math.floor(start / MAX_BATCH_SIZE) + 1;
		const chunk = items.slice(start, start + MAX_BATCH_SIZE);

		onProgress?.({
			totalItems,
			processedItems: start,
			currentBatch,
			totalBatches,
			imported,
			skipped,
			failed,
		});

		const result = await importMutate({ body: { items: chunk } });
		imported += result.imported;
		skipped += result.skipped;
		failed += result.failed;
		errors.push(...result.errors.map((error) => error.message));

		onProgress?.({
			totalItems,
			processedItems: Math.min(start + chunk.length, totalItems),
			currentBatch,
			totalBatches,
			imported,
			skipped,
			failed,
		});
	}

	return {
		imported,
		skipped,
		failed,
		errors,
	};
}

export async function parseCsvText(csvText: string): Promise<{
	items: NormalizedImportItemDto[];
	errors: CsvParseError[];
}> {
	return new Promise((resolve, reject) => {
		Papa.parse<Record<string, string>>(csvText, {
			header: true,
			skipEmptyLines: true,
			complete: (results) => {
				const items: NormalizedImportItemDto[] = [];
				const errors: CsvParseError[] = [];
				const headers = (results.meta.fields ?? []).map((header) =>
					header.trim(),
				);

				for (const expectedHeader of CSV_HEADERS) {
					if (!headers.includes(expectedHeader)) {
						errors.push({
							row: 1,
							message: `Missing required header: ${expectedHeader}`,
						});
					}
				}

				if (errors.length > 0) {
					resolve({ items, errors });
					return;
				}

				for (let rowIndex = 0; rowIndex < results.data.length; rowIndex++) {
					const row = results.data[rowIndex] ?? {};
					const normalized = normalizeCsvRow(row, rowIndex + 2);
					if (normalized.item) {
						items.push(normalized.item);
					} else if (normalized.error) {
						errors.push(normalized.error);
					}
				}

				resolve({ items, errors });
			},
			error: (error: Error) => {
				reject(error);
			},
		});
	});
}

function normalizeCsvRow(
	row: Record<string, string>,
	rowNumber: number,
): { item?: NormalizedImportItemDto; error?: CsvParseError } {
	const type = getCsvValue(row, "type").toLowerCase();
	const watchedAtRaw = getCsvValue(row, "watched_at");
	const watchedAt = Number.isNaN(Date.parse(watchedAtRaw))
		? ""
		: new Date(watchedAtRaw).toISOString();
	const actionRaw = getCsvValue(row, "action").toLowerCase();
	const action = actionRaw || "watch";

	if (!["watch", "scrobble", "checkin"].includes(action)) {
		return {
			error: {
				row: rowNumber,
				message: `Row ${rowNumber}: unsupported action "${actionRaw || "unknown"}"`,
			},
		};
	}

	if (!watchedAt) {
		return {
			error: {
				row: rowNumber,
				message: `Row ${rowNumber}: invalid watched_at`,
			},
		};
	}

	if (type === "movie") {
		const movieTmdbId = Number.parseInt(getCsvValue(row, "tmdb_id"), 10);
		if (!Number.isInteger(movieTmdbId) || movieTmdbId < 1) {
			return {
				error: {
					row: rowNumber,
					message: `Row ${rowNumber}: missing movie TMDB id`,
				},
			};
		}

		return {
			item: {
				type: "movie",
				movieTmdbId,
				action: action as "watch" | "scrobble" | "checkin",
				watchedAt,
			},
		};
	}

	if (type === "episode") {
		const showTmdbId = Number.parseInt(getCsvValue(row, "tmdb_id"), 10);
		const seasonNumber = Number.parseInt(getCsvValue(row, "season_number"), 10);
		const episodeNumber = Number.parseInt(
			getCsvValue(row, "episode_number"),
			10,
		);

		if (!Number.isInteger(showTmdbId) || showTmdbId < 1) {
			return {
				error: {
					row: rowNumber,
					message: `Row ${rowNumber}: missing show TMDB id`,
				},
			};
		}

		if (
			!Number.isInteger(seasonNumber) ||
			seasonNumber < 0 ||
			!Number.isInteger(episodeNumber) ||
			episodeNumber < 1
		) {
			return {
				error: {
					row: rowNumber,
					message: `Row ${rowNumber}: invalid season/episode values`,
				},
			};
		}

		return {
			item: {
				type: "episode",
				showTmdbId,
				seasonNumber,
				episodeNumber,
				action: action as "watch" | "scrobble" | "checkin",
				watchedAt,
			},
		};
	}

	return {
		error: {
			row: rowNumber,
			message: `Row ${rowNumber}: unsupported type "${type || "unknown"}"`,
		},
	};
}

function getCsvValue(row: Record<string, string>, key: string): string {
	const value = row[key];
	if (typeof value === "string" && value.trim()) {
		return value.trim();
	}
	return "";
}
