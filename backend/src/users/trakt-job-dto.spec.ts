import { buildTraktImportData } from "./background-job-data";
import {
	type BackgroundJobRecord,
	buildProfileFromJobData,
	mapTraktImportIssue,
	mapTraktImportJob,
} from "./trakt-job-dto";

function jobRecord(
	overrides: Partial<NonNullable<BackgroundJobRecord>> = {},
): NonNullable<BackgroundJobRecord> {
	return {
		id: "job-1",
		type: "trakt_import",
		userDid: "did:plc:abc",
		status: "running",
		data: buildTraktImportData({
			traktUsername: "rowan",
			importedCount: 12,
			skippedCount: 3,
			failedCount: 2,
			currentPage: 4,
		}),
		attempts: 0,
		lastError: null,
		nextRunAt: new Date("2026-07-01T10:00:00.000Z"),
		startedAt: new Date("2026-07-01T09:00:00.000Z"),
		completedAt: null,
		createdAt: new Date("2026-06-30T08:00:00.000Z"),
		updatedAt: new Date("2026-07-01T09:30:00.000Z"),
		...overrides,
	} as any;
}

describe("mapTraktImportJob", () => {
	it("serialises dates and reads the counters out of the job payload", () => {
		const dto = mapTraktImportJob(jobRecord());

		expect(dto.status).toBe("running");
		expect(dto.traktUsername).toBe("rowan");
		expect(dto.currentPage).toBe(4);
		expect(dto.importedCount).toBe(12);
		expect(dto.nextRunAt).toBe("2026-07-01T10:00:00.000Z");
		expect(dto.startedAt).toBe("2026-07-01T09:00:00.000Z");
		expect(dto.completedAt).toBeUndefined();
	});

	it("reports failures as couldntImportCount and drops null lastError", () => {
		const dto = mapTraktImportJob(jobRecord());

		expect(dto.couldntImportCount).toBe(dto.failedCount);
		expect(dto.couldntImportCount).toBe(2);
		expect(dto.lastError).toBeUndefined();
	});
});

describe("mapTraktImportIssue", () => {
	const row = {
		id: "item-1",
		sourceIndex: 7,
		outcome: "unmatched",
		mediaType: "episode",
		title: "Severance",
		year: 2022,
		episodeTitle: "Good News About Hell",
		seasonNumber: 1,
		episodeNumber: 1,
		watchedAt: new Date("2026-03-22T12:00:00.000Z"),
		reason: null,
		message: null,
	};

	it("maps an unmatched episode row", () => {
		const dto = mapTraktImportIssue(row);

		expect(dto.outcome).toBe("unmatched");
		expect(dto.mediaType).toBe("episode");
		expect(dto.watchedAt).toBe("2026-03-22T12:00:00.000Z");
		expect(dto.reason).toBeUndefined();
	});

	it("collapses any other outcome to couldnt_import and unknown media", () => {
		const dto = mapTraktImportIssue({
			...row,
			outcome: "something_else",
			mediaType: "book",
			watchedAt: null,
		});

		expect(dto.outcome).toBe("couldnt_import");
		expect(dto.mediaType).toBe("unknown");
		expect(dto.watchedAt).toBeUndefined();
	});
});

describe("buildProfileFromJobData", () => {
	it("falls back to the Trakt username when no profile was cached", () => {
		const profile = buildProfileFromJobData({
			traktUsername: "rowan",
		} as any);

		expect(profile.username).toBe("rowan");
		expect(profile.slug).toBe("rowan");
		expect(profile.avatarUrl).toBeUndefined();
	});
});
