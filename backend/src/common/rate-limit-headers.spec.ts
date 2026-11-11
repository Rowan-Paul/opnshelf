import { afterEach, expect, it, vi } from "vitest";
import {
	retryAfterSeconds,
	rateLimitRetrySeconds,
	rateLimitExhausted,
} from "./rate-limit-headers";

afterEach(() => vi.useRealTimers());

it("accepts delta-seconds reset headers and avoids a full fallback for expired epochs", () => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date("2026-11-11T10:00:00Z"));
	expect(
		rateLimitRetrySeconds(new Headers({ "ratelimit-reset": "60" }), 300),
	).toBe(60);
	expect(
		rateLimitRetrySeconds(
			new Headers({ "ratelimit-reset": String(Date.now() / 1000 - 10) }),
			300,
		),
	).toBe(1);
});
it.each([
	["900", 900],
	["0", 1],
	["", 300],
	[null, 300],
	["-1", 300],
	["invalid", 300],
])("parses Retry-After %s", (header, expected) => {
	expect(retryAfterSeconds(header === null ? null : String(header), 300)).toBe(
		expected,
	);
});
it("uses HTTP-date Retry-After and rejects dates in the past", () => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date("2026-11-11T10:00:00Z"));
	expect(retryAfterSeconds("Wed, 11 Nov 2026 10:15:00 GMT", 300)).toBe(900);
	expect(retryAfterSeconds("Wed, 11 Nov 2026 09:00:00 GMT", 300)).toBe(300);
});

it("uses the later reset header and Retry-After, including without Retry-After", () => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date("2026-11-11T10:00:00Z"));
	const reset = String(Date.now() / 1000 + 3600);
	expect(
		rateLimitRetrySeconds(new Headers({ "ratelimit-reset": reset }), 300),
	).toBe(3600);
	expect(
		rateLimitRetrySeconds(
			new Headers({ "ratelimit-reset": reset, "retry-after": "900" }),
			300,
		),
	).toBe(3600);
});

it("uses Trakt reset metadata and ignores malformed metadata", () => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date("2026-11-11T10:00:00Z"));
	const headers = new Headers({
		"x-ratelimit": JSON.stringify({
			remaining: 0,
			until: "2026-11-11T10:15:00Z",
		}),
		"retry-after": "60",
	});
	expect(rateLimitRetrySeconds(headers, 300)).toBe(900);
	expect(rateLimitExhausted(headers)).toBe(true);
	for (const value of [
		"bad json",
		"[]",
		"null",
		"42",
		JSON.stringify({ remaining: "0", until: "invalid" }),
	]) {
		expect(
			rateLimitRetrySeconds(new Headers({ "x-ratelimit": value }), 300),
		).toBe(300);
		expect(rateLimitExhausted(new Headers({ "x-ratelimit": value }))).toBe(
			false,
		);
	}
});
