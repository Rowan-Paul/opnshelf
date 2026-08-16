import { isAtprotoRecordMissingError } from "./atproto-record-errors";

describe("isAtprotoRecordMissingError", () => {
	it.each([
		{ status: 404 },
		{ status: 400, error: "RecordNotFound" },
		new Error("RecordNotFound"),
		new Error("Delete target record does not exist"),
	])("accepts an explicit missing-record shape", (error) => {
		expect(isAtprotoRecordMissingError(error)).toBe(true);
	});

	it.each([
		new Error("network unavailable"),
		{ status: 429, error: "RateLimitExceeded" },
		{ status: 500, error: "InternalServerError" },
		{ status: 400, error: "InvalidRequest", message: "invalid rkey" },
	])("rejects a non-missing failure", (error) => {
		expect(isAtprotoRecordMissingError(error)).toBe(false);
	});
});
