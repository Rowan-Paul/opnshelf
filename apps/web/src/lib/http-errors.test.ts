import { describe, expect, it } from "vitest";
import { getErrorMessage } from "../../../../packages/api/src/http-errors";

describe("API error messages", () => {
	it("keeps Error and plain JSON messages", () => {
		expect(getErrorMessage(new Error("Network unavailable"), "Retry")).toBe(
			"Network unavailable",
		);
		expect(
			getErrorMessage(
				{
					statusCode: 409,
					message: "Another Watch operation is in progress. Try again.",
				},
				"Retry",
			),
		).toBe("Another Watch operation is in progress. Try again.");
	});
	it("joins validation messages and rejects missing or malformed messages", () => {
		expect(
			getErrorMessage({ message: ["First issue", "Second issue"] }, "Retry"),
		).toBe("First issue Second issue");
		for (const error of [
			null,
			undefined,
			{},
			{ message: [] },
			{ message: [42] },
			{ message: " " },
		])
			expect(getErrorMessage(error, "Retry")).toBe("Retry");
	});
});
