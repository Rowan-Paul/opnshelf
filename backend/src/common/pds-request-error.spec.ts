import { afterEach, expect, it, vi } from "vitest";
import { pdsRequestError, retryAfterSeconds } from "./pds-request-error";

afterEach(() => vi.useRealTimers());
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
it.each([429, 503])("finds status %s through OAuth error causes", (status) => {
	const error = new Error("unsafe details", {
		cause: {
			response: new Response(null, {
				status,
				headers: { "retry-after": "900" },
			}),
		},
	});
	expect(pdsRequestError(error)).toMatchObject({
		upstreamStatus: status,
		retrySeconds: 900,
	});
	expect(pdsRequestError(error)?.getStatus()).toBe(503);
});
it("ignores invalid credentials and cyclic causes", () => {
	expect(pdsRequestError({ status: 401 })).toBeUndefined();
	const error = new Error("cycle");
	error.cause = error;
	expect(pdsRequestError(error)).toBeUndefined();
});
