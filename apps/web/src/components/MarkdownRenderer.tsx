import type { ComponentPropsWithoutRef } from "react";
import Markdown from "react-markdown";
import remarkBreaks from "remark-breaks";

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

// Element styling lives as descendant variants on the wrapper so they apply to
// react-markdown's output and reliably win over nested defaults (e.g. inline
// code styling inside a fenced block). Mirrors the look of the former
// hand-rolled MarkdownPreview.
const PROSE_CLASS = [
	"space-y-3 text-sm leading-relaxed",
	"[&_h1]:font-display [&_h1]:font-semibold [&_h1]:text-lg",
	"[&_h2]:font-display [&_h2]:font-semibold [&_h2]:text-lg",
	"[&_h3]:font-semibold [&_h4]:font-semibold [&_h5]:font-semibold [&_h6]:font-semibold",
	"[&_ul]:list-inside [&_ul]:list-disc [&_ul]:space-y-1",
	"[&_ol]:list-inside [&_ol]:list-decimal [&_ol]:space-y-1",
	"[&_blockquote]:border-(--border) [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:text-(--foreground-muted) [&_blockquote]:italic",
	"[&_code]:rounded [&_code]:bg-(--background-subtle) [&_code]:px-1",
	"[&_pre]:overflow-auto [&_pre]:rounded [&_pre]:bg-(--background-subtle) [&_pre]:p-3 [&_pre]:text-xs",
	"[&_pre_code]:bg-transparent [&_pre_code]:p-0",
	"[&_a]:text-(--accent) [&_a]:underline hover:[&_a]:no-underline",
].join(" ");

function MarkdownLink({ ...props }: ComponentPropsWithoutRef<"a">) {
	// User-authored external links: open in a new tab and drop referrer / link
	// equity since these point at arbitrary sites.
	return <a {...props} target="_blank" rel="noopener noreferrer nofollow" />;
}

export function MarkdownContent({ markdown }: { markdown: string }) {
	// The editor serialises some hard breaks as literal <br> HTML; react-markdown
	// doesn't render raw HTML, so turn them into newlines (which remark-breaks
	// then renders as breaks) rather than showing "<br />" as text.
	const normalized = markdown.replace(/<br\s*\/?>/gi, "\n");
	return (
		<div className={PROSE_CLASS}>
			<Markdown remarkPlugins={[remarkBreaks]} components={{ a: MarkdownLink }}>
				{normalized}
			</Markdown>
		</div>
	);
}
