import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface PrevNextTarget {
	/** "Previous season", "Next episode". */
	label: string;
	/** The target's code, e.g. "S1" or "S1E2". */
	code: string;
	href: string;
}

/**
 * Previous/next paging between sibling seasons or episodes. A side with no
 * neighbour is left out rather than disabled, and the remaining button keeps
 * to its own edge. Mirrors the Mobile App's `PrevNextNav`.
 */
export function PrevNextNav({
	previous,
	next,
}: {
	previous?: PrevNextTarget;
	next?: PrevNextTarget;
}) {
	if (!previous && !next) return null;

	return (
		<nav aria-label="Previous and next" className="flex items-center gap-2">
			{previous && (
				<Link
					to={previous.href}
					aria-label={`${previous.label}, ${previous.code}`}
					className="btn btn-secondary gap-2"
				>
					<ChevronLeft className="size-4" />
					<span className="flex flex-col items-start leading-tight">
						<span>{previous.label}</span>
						<span className="text-(--foreground-muted) text-xs">
							{previous.code}
						</span>
					</span>
				</Link>
			)}
			{next && (
				<Link
					to={next.href}
					aria-label={`${next.label}, ${next.code}`}
					className="btn btn-secondary ml-auto gap-2"
				>
					<span className="flex flex-col items-end leading-tight">
						<span>{next.label}</span>
						<span className="text-(--foreground-muted) text-xs">
							{next.code}
						</span>
					</span>
					<ChevronRight className="size-4" />
				</Link>
			)}
		</nav>
	);
}
