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
 * Previous/next paging between sibling seasons or episodes, sized for the
 * breadcrumb row of `MediaHero`. Each side shows its target's code beside the
 * chevron; a side with no neighbour is left out rather than disabled. Mirrors
 * the Mobile App's `PrevNextNav`.
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
		<nav
			aria-label="Previous and next"
			className="ml-auto flex shrink-0 items-center gap-2 text-sm [text-shadow:0_1px_3px_rgb(0_0_0/0.6)] sm:gap-4"
		>
			{[previous, next].map((target, index) => {
				if (!target) return null;
				const Icon = index === 0 ? ChevronLeft : ChevronRight;
				return (
					<Link
						key={target.href}
						to={target.href}
						aria-label={`${target.label}, ${target.code}`}
						className="btn h-11 min-w-11 gap-1 p-0 text-white/80 hover:text-white"
					>
						<Icon
							aria-hidden="true"
							className={index === 0 ? "size-4" : "order-last size-4"}
						/>
						<span>{target.code}</span>
					</Link>
				);
			})}
		</nav>
	);
}
