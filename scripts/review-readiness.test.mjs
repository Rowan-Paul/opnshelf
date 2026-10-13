import { test } from "node:test";
import assert from "node:assert/strict";
import { reviewReadiness } from "./review-readiness.mjs";

test("requires requested reviewer approval on current head; a skipped or stale review is pending", () => {
	const pr = {
		url: "https://example.test/pr/1",
		headRefOid: "current",
		reviews: [],
	};
	assert.equal(reviewReadiness(pr, "coderabbitai").ready, false);
	pr.reviews.push({
		author: { login: "coderabbitai[bot]" },
		state: "APPROVED",
		commit: { oid: "old" },
		submittedAt: "2026-01-01",
	});
	assert.equal(reviewReadiness(pr, "coderabbitai").ready, false);
	pr.reviews.push({
		author: { login: "coderabbitai[bot]" },
		state: "APPROVED",
		commit: { oid: "current" },
		submittedAt: "2026-01-02",
	});
	assert.equal(reviewReadiness(pr, "coderabbitai").ready, true);
	pr.reviews.push({
		author: { login: "coderabbitai[bot]" },
		state: "COMMENTED",
		commit: { oid: "current" },
		submittedAt: "2026-01-02T12:00:00Z",
	});
	assert.equal(reviewReadiness(pr, "coderabbitai").ready, true);
	pr.reviews.push({
		author: { login: "coderabbitai[bot]" },
		state: "CHANGES_REQUESTED",
		commit: { oid: "current" },
		submittedAt: "2026-01-03",
	});
	assert.equal(reviewReadiness(pr, "coderabbitai").ready, false);
	assert.equal(reviewReadiness(pr, "other-reviewer").ready, false);
});
