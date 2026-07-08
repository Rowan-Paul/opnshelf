import { type MouseEvent, useState } from "react";
import { reviewExcerpt } from "#/lib/review-excerpt";
import { MarkdownContent } from "./MarkdownContent";

/**
 * A review body in a list. Short reviews render in full (formatted). Long ones
 * show a plain-text excerpt with a "Read more" that expands the full formatted
 * review inline — no gradient fade clipping mid-element.
 *
 * The toggle carries `z-[1]` + stopPropagation so it works above (and doesn't
 * trigger) the click-anywhere overlay link on cards like ProfileContentCard.
 * Only safe where the body is NOT itself nested inside an <a>.
 */
export function ReviewBody({ markdown }: { markdown: string }) {
	const [expanded, setExpanded] = useState(false);
	const { text, truncated } = reviewExcerpt(markdown);

	if (!truncated) {
		return <MarkdownContent markdown={markdown} />;
	}

	const toggle = (
		<button
			type="button"
			onClick={(e: MouseEvent) => {
				e.stopPropagation();
				setExpanded((v) => !v);
			}}
			className="relative z-[1] mt-1 font-medium text-(--accent) text-sm hover:underline"
		>
			{expanded ? "Show less" : "Read more"}
		</button>
	);

	return expanded ? (
		<>
			<MarkdownContent markdown={markdown} />
			{toggle}
		</>
	) : (
		<>
			<p>{text}</p>
			{toggle}
		</>
	);
}
