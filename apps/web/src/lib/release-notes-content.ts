import { parseReleaseNotes, type ReleaseNote } from "@opnshelf/api";

/** JSON front matter keeps authoring dependency-free; the body remains Markdown. */
export function compileReleaseNotes(
	sources: Record<string, string>,
): ReleaseNote[] {
	const entries: unknown[] = [];
	for (const [path, source] of Object.entries(sources)) {
		const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(source);
		if (!match) throw new Error(`Invalid Release Notes front matter: ${path}`);
		const metadata = JSON.parse(match[1]);
		if (metadata.status !== "draft" && metadata.status !== "published")
			throw new Error(`Missing publication status: ${path}`);
		if (metadata.status === "draft") continue;
		entries.push({ ...metadata, markdown: match[2].trim() });
	}
	return parseReleaseNotes(entries);
}

export function visibleReleaseNotes(
	entries: ReleaseNote[],
	siteUrl: string | undefined,
	development: boolean,
	now = Date.now(),
): ReleaseNote[] {
	// Fail closed on Staging and unknown deployments. Never infer production from
	// a caller-controlled Host header. Local development previews approved entries.
	if (!development && siteUrl !== "https://opnshelf.xyz") return [];
	return entries.filter((entry) => Date.parse(entry.publishedAt) <= now);
}
