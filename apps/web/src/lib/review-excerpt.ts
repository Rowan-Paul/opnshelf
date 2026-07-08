// Longest plain-text preview shown before a review collapses behind "Read more"
// (a few lines). Mirrors the backend's review excerpt length.
const EXCERPT_MAX = 280;

/** Strip markdown to a single line of plain text for a preview. */
function toPlainText(markdown: string): string {
	return markdown
		.replace(/```[\s\S]*?```/g, " ")
		.replace(/`[^`]*`/g, " ")
		.replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
		.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
		.replace(/^#{1,6}\s+/gm, "")
		.replace(/[*_~>#-]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

/**
 * Plain-text excerpt of a review body. `truncated` is true only when the body
 * is long enough to hide behind a "Read more" — short reviews come back
 * untruncated so callers can render them in full (formatted) instead.
 */
export function reviewExcerpt(markdown: string): {
	text: string;
	truncated: boolean;
} {
	const plain = toPlainText(markdown);
	if (plain.length <= EXCERPT_MAX) {
		return { text: plain, truncated: false };
	}
	return { text: `${plain.slice(0, EXCERPT_MAX).trimEnd()}…`, truncated: true };
}
