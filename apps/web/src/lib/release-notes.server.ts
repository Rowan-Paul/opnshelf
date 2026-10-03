import {
	compileReleaseNotes,
	visibleReleaseNotes,
} from "./release-notes-content";

const sources = import.meta.glob("../../content/release-notes/*.md", {
	query: "?raw",
	import: "default",
	eager: true,
}) as Record<string, string>;
const entries = compileReleaseNotes(sources);
export function publishedReleaseNotes() {
	return visibleReleaseNotes(
		entries,
		import.meta.env.VITE_SITE_URL,
		import.meta.env.DEV,
	);
}
