import { reviewExcerpt } from "#/lib/review-excerpt";
import { MarkdownContent } from "./MarkdownContent";

/**
 * A review body in a list. Short reviews render in full (formatted). Long ones
 * render the same formatted markdown clamped to a few lines with a "Read more"
 * that opens the review's detail page — so bold, line breaks and lists all read
 * the same as in the editor, and the full review lives on its own page.
 *
 * `href` is the review's permalink; when omitted (e.g. inside a card that is
 * itself a link to the review) "Read more" renders as a plain cue. `full` forces
 * the whole review (used for a deep-linked/highlighted review).
 */
export function ReviewBody({
	markdown,
	href,
	full = false,
}: {
	markdown: string;
	href?: string;
	full?: boolean;
}) {
	const { truncated } = reviewExcerpt(markdown);

	if (full || !truncated) {
		return <MarkdownContent markdown={markdown} />;
	}

	return (
		<div>
			<div className="line-clamp-5">
				<MarkdownContent markdown={markdown} />
			</div>
			{href ? (
				<a
					href={href}
					className="relative z-[1] mt-1 inline-block font-medium text-(--accent) text-sm hover:underline"
				>
					Read more
				</a>
			) : (
				<span className="mt-1 inline-block font-medium text-(--accent) text-sm">
					Read more
				</span>
			)}
		</div>
	);
}
