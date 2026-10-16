import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
	compileReleaseNotes,
	visibleReleaseNotes,
} from "./release-notes-content";

const publishedAt = "2026-10-01T12:00:00.000Z";
const source = (overrides = {}) =>
	`---\n${JSON.stringify({ status: "published", slug: "better-shelves", title: "Better shelves", summary: "Find your watches", publishedAt, platforms: { web: { status: "available" }, ios: { status: "coming-soon" }, android: { status: "update-required", minimumVersion: "1.7.0" } }, ...overrides })}\n---\n## Changes\nYour watches are easier to find.`;

describe("Release Notes publication", () => {
	it("excludes drafts from both listing and direct-link data", () => {
		const feed = compileReleaseNotes({
			"approved.md": source(),
			"secret.md": source({
				status: "draft",
				slug: "secret",
				title: "Unannounced",
			}),
		});
		expect(feed.map((entry) => entry.slug)).toEqual(["better-shelves"]);
		expect(JSON.stringify(feed)).not.toContain("Unannounced");
	});
	it("fails closed on missing approval, duplicate identities, and invalid availability", () => {
		expect(() =>
			compileReleaseNotes({ "bad.md": source({ status: undefined }) }),
		).toThrow();
		expect(() =>
			compileReleaseNotes({ "a.md": source(), "b.md": source() }),
		).toThrow();
		expect(() =>
			compileReleaseNotes({ "bad.md": source({ platforms: {} }) }),
		).toThrow();
	});
	it("publishes only on the production site or local development, after the publication date", () => {
		const entries = compileReleaseNotes({ "note.md": source() });
		const now = Date.parse(publishedAt);
		expect(
			visibleReleaseNotes(entries, "https://staging.opnshelf.xyz", false, now),
		).toEqual([]);
		expect(visibleReleaseNotes(entries, undefined, false, now)).toEqual([]);
		expect(
			visibleReleaseNotes(entries, "https://opnshelf.xyz", false, now - 1),
		).toEqual([]);
		expect(
			visibleReleaseNotes(entries, "https://opnshelf.xyz", false, now),
		).toHaveLength(1);
		expect(visibleReleaseNotes(entries, undefined, true, now)).toHaveLength(1);
	});
	it("orders entries by immutable publication date rather than edits", () => {
		const notes = compileReleaseNotes({
			"old.md": source({ title: "Corrected title" }),
			"new.md": source({
				slug: "new",
				publishedAt: "2026-10-02T00:00:00.000Z",
			}),
		});
		expect(notes.map((note) => note.slug)).toEqual(["new", "better-shelves"]);
	});
	it("validates every checked-in entry, including drafts before approval", () => {
		const directory = resolve(process.cwd(), "content/release-notes");
		for (const file of readdirSync(directory).filter((name) =>
			name.endsWith(".md"),
		)) {
			const content = readFileSync(resolve(directory, file), "utf8");
			expect(
				compileReleaseNotes({
					[file]: content.replace('"status": "draft"', '"status": "published"'),
				}),
			).toHaveLength(1);
		}
	});
});
