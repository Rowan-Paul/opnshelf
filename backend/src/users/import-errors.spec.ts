import {
	PDS_RETRY_FALLBACK_SECONDS,
	PDS_RETRY_MAX_SECONDS,
	classifyImportWriteError,
	formatRetryDelay,
	getPdsRetryAfterSeconds,
	secondsUntilPdsReset,
} from "./import-errors";

describe("secondsUntilPdsReset", () => {
	it("converts an absolute reset epoch into a delay from now", () => {
		const reset = Math.floor(Date.now() / 1000) + 120;
		expect(secondsUntilPdsReset({ reset })).toBeGreaterThan(115);
		expect(secondsUntilPdsReset({ reset })).toBeLessThanOrEqual(122);
	});

	it("caps a daily-budget reset far in the future", () => {
		const reset = Math.floor(Date.now() / 1000) + 48 * 60 * 60;
		expect(secondsUntilPdsReset({ reset })).toBe(PDS_RETRY_MAX_SECONDS);
	});

	it("falls back when the window has already passed or is missing", () => {
		const past = Math.floor(Date.now() / 1000) - 10;
		expect(secondsUntilPdsReset({ reset: past })).toBe(
			PDS_RETRY_FALLBACK_SECONDS,
		);
		expect(secondsUntilPdsReset(undefined)).toBe(PDS_RETRY_FALLBACK_SECONDS);
	});
});

describe("getPdsRetryAfterSeconds", () => {
	it("prefers ratelimit-reset over retry-after", () => {
		const reset = Math.floor(Date.now() / 1000) + 600;
		const seconds = getPdsRetryAfterSeconds({
			headers: { "ratelimit-reset": String(reset), "retry-after": "5" },
		});
		expect(seconds).toBeGreaterThan(595);
	});

	it("reads retry-after when the PDS sends no reset header", () => {
		expect(getPdsRetryAfterSeconds({ headers: { "retry-after": "30" } })).toBe(
			30,
		);
	});

	it("returns undefined without usable headers", () => {
		expect(getPdsRetryAfterSeconds({})).toBeUndefined();
		expect(getPdsRetryAfterSeconds(null)).toBeUndefined();
	});
});

describe("formatRetryDelay", () => {
	it("scales the unit to the size of the wait", () => {
		expect(formatRetryDelay(1)).toBe("1 second");
		expect(formatRetryDelay(45)).toBe("45 seconds");
		expect(formatRetryDelay(120)).toBe("2 minutes");
		expect(formatRetryDelay(3600)).toBe("1 hour");
		expect(formatRetryDelay(2717)).toBe("45 minutes");
		expect(formatRetryDelay(5400)).toBe("1 hour 30 minutes");
	});
});

describe("classifyImportWriteError", () => {
	it("buckets a duplicate rkey as an already-imported watch", () => {
		expect(
			classifyImportWriteError(
				new Error("Unique constraint failed on the fields: (`rkey`)"),
			).reason,
		).toBe("duplicate_record");
	});

	it("buckets a TMDB miss as missing metadata", () => {
		expect(
			classifyImportWriteError(new Error("TMDB movie details request failed"))
				.reason,
		).toBe("metadata_unavailable");
	});

	it("buckets a PDS write as an upstream failure", () => {
		expect(
			classifyImportWriteError(new Error("com.atproto.repo.putRecord failed"))
				.reason,
		).toBe("upstream_write_failed");
	});

	it("falls back to unknown and keeps the raw message", () => {
		const result = classifyImportWriteError(new Error("something odd"));
		expect(result.reason).toBe("unknown");
		expect(result.rawMessage).toBe("something odd");
	});
});
