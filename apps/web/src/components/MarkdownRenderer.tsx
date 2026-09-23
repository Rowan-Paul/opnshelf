import type { ComponentPropsWithoutRef } from "react";
import Markdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import { normalizeMarkdown, PROSE_CLASS } from "./MarkdownContent";

/**
 * Canonical read renderer for review markdown. Reviews are authored in Milkdown
 * (WYSIWYG over a markdown source of truth) and stored as portable
 * `at.markpub.markdown`; this renders that same markdown for reading. It shares
 * one engine — `remark` via react-markdown, the same family Milkdown uses — so
 * what the writer sees, what is stored, and what readers see all agree, and it
 * matches how the wider standard.site ecosystem parses the record.
 *
 * CommonMark only (no GFM): the editor's feature surface is headings, bold,
 * italic, inline code, code blocks, blockquotes, lists, and links. react-markdown
 * does not render raw HTML by default, so user-authored HTML is never injected.
 *
 * `remark-breaks` renders single newlines as hard breaks so a line break the
 * author made in the Milkdown editor shows the same way when the review is read
 * back (the editor keeps the visual line even where CommonMark would collapse
 * a lone newline to a space).
 */

function MarkdownLink({ ...props }: ComponentPropsWithoutRef<"a">) {
	// User-authored external links: open in a new tab and drop referrer / link
	// equity since these point at arbitrary sites.
	return <a {...props} target="_blank" rel="noopener noreferrer nofollow" />;
}

export default function MarkdownRenderer({ markdown }: { markdown: string }) {
	return (
		<div className={PROSE_CLASS}>
			<Markdown remarkPlugins={[remarkBreaks]} components={{ a: MarkdownLink }}>
				{normalizeMarkdown(markdown)}
			</Markdown>
		</div>
	);
}
