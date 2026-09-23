import { lazy, Suspense } from "react";

// Element styling lives as descendant variants on the wrapper so they apply to
// react-markdown's output and reliably win over nested defaults (e.g. inline
// code styling inside a fenced block). Mirrors the look of the former
// hand-rolled MarkdownPreview.
export const PROSE_CLASS = [
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

/**
 * The editor serialises some hard breaks as literal <br> HTML; react-markdown
 * doesn't render raw HTML, so turn them into newlines (which remark-breaks then
 * renders as breaks) rather than showing "<br />" as text.
 */
export function normalizeMarkdown(markdown: string): string {
	return markdown.replace(/<br\s*\/?>/gi, "\n");
}

// react-markdown and its remark pipeline are the heaviest thing on a detail
// page and only draw review bodies, which sit below the fold. SSR still
// renders the formatted markdown; the browser fetches the renderer on its own.
const MarkdownRenderer = lazy(() => import("./MarkdownRenderer"));

/** Review markdown for reading. See `MarkdownRenderer` for the rules. */
export function MarkdownContent({ markdown }: { markdown: string }) {
	return (
		<Suspense
			fallback={
				<div className={`${PROSE_CLASS} whitespace-pre-line`}>
					{normalizeMarkdown(markdown)}
				</div>
			}
		>
			<MarkdownRenderer markdown={markdown} />
		</Suspense>
	);
}
