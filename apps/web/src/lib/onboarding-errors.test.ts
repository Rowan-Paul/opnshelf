import { describe, expect, it } from "vitest";
import {
	buildImportErrorList,
	getSafeImportErrorMessage,
	getSafeOnboardingErrorMessage,
} from "./onboarding-errors";

describe("onboarding error helpers", () => {
	it("falls back for raw backend errors", () => {
		expect(
			getSafeOnboardingErrorMessage(
				new Error("Unique constraint failed on the fields: (`rkey`)"),
				"Could not import your history right now.",
			),
		).toBe("Could not import your history right now.");
	});

	it("preserves allowlisted safe backend messages", () => {
		expect(
			getSafeOnboardingErrorMessage(
				{ body: { message: "Trakt user not found" } },
				"Could not fetch Trakt history right now.",
			),
		).toBe("Trakt user not found");
	});

	it("sanitizes server import errors, deduplicates them, and caps the visible list", () => {
		const errors = buildImportErrorList(
			["Row 2: invalid watched_at"],
			[
				"Unique constraint failed on the fields: (`rkey`)",
				"We couldn't fetch details for this title right now.",
				"We couldn't fetch details for this title right now.",
				...Array.from({ length: 10 }, (_, index) => `raw error ${index + 1}`),
			],
		);

		expect(errors).toEqual([
			"Row 2: invalid watched_at",
			"We couldn't import this item.",
			"We couldn't fetch details for this title right now.",
		]);
	});

	it("keeps sanitized import messages unchanged", () => {
		expect(
			getSafeImportErrorMessage(
				"We couldn't fetch details for this title right now.",
			),
		).toBe("We couldn't fetch details for this title right now.");
	});
});
