import { Clapperboard, Film, Search, Tv, Users } from "lucide-react";
import type { SearchTab } from "#/lib/search-results";

export const SEARCH_TAB_OPTIONS: {
	key: SearchTab;
	label: string;
	icon: typeof Film;
}[] = [
	{ key: "all", label: "All", icon: Search },
	{ key: "movies", label: "Movies", icon: Film },
	{ key: "shows", label: "TV Shows", icon: Tv },
	{ key: "cast", label: "Cast & Crew", icon: Clapperboard },
	{ key: "people", label: "Users", icon: Users },
];

/**
 * The result-type tab bar on the Search page. Tabs only filter search
 * results, so the bar stays hidden on the discover (empty query) state
 * instead of filtering the rows too.
 */
export function SearchTabs({
	activeTab,
	hidden,
	onChange,
}: {
	activeTab: SearchTab;
	hidden: boolean;
	onChange: (tab: SearchTab) => void;
}) {
	return (
		<div
			className={`mb-6 border-(--border) border-b ${hidden ? "hidden" : ""}`}
		>
			<nav className="flex gap-1 overflow-x-auto">
				{SEARCH_TAB_OPTIONS.map((tab) => {
					const Icon = tab.icon;
					const isActive = activeTab === tab.key;
					return (
						<button
							key={tab.key}
							type="button"
							onClick={() => onChange(tab.key)}
							aria-pressed={isActive}
							className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 font-medium text-sm transition-colors ${
								isActive
									? "border-(--accent) text-(--accent)"
									: "border-transparent text-(--foreground-muted) hover:border-(--border-strong) hover:text-(--foreground)"
							}`}
						>
							<Icon className="h-4 w-4" />
							{tab.label}
						</button>
					);
				})}
			</nav>
		</div>
	);
}
