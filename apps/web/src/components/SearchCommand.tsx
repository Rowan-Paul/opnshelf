import { CatchBoundary } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";

// cmdk, the dialog, and the search queries load in their own chunk the first
// time search is wanted, so they stay off every page's first load.
const loadDialog = () => import("./SearchCommandDialog");
const SearchCommandDialog = lazy(loadDialog);

interface SearchCommandProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function SearchCommand({ open, onOpenChange }: SearchCommandProps) {
	// Stays mounted after the first open so closing keeps its exit animation.
	const [wanted, setWanted] = useState(open);
	if (open && !wanted) setWanted(true);
	const isOpenRef = useRef(open);
	isOpenRef.current = open;
	const onOpenChangeRef = useRef(onOpenChange);
	onOpenChangeRef.current = onOpenChange;

	useEffect(() => {
		const down = (e: KeyboardEvent) => {
			if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				onOpenChangeRef.current(!isOpenRef.current);
			}
		};
		document.addEventListener("keydown", down);
		return () => document.removeEventListener("keydown", down);
	}, []);

	return (
		<>
			<button
				type="button"
				onClick={() => onOpenChange(true)}
				onPointerEnter={loadDialog}
				onFocus={loadDialog}
				className="group flex h-9 items-center gap-2 rounded-md border border-(--border) bg-(--background-elevated) px-3 text-(--foreground-muted) transition-colors hover:border-(--border-strong) hover:bg-(--background-subtle) hover:text-(--foreground)"
				aria-label="Search"
				data-tour="command"
			>
				<Search className="size-4" />
				<span className="hidden text-sm sm:inline">Search</span>
				<kbd className="ml-1 hidden h-5 select-none items-center gap-0.5 rounded border border-(--border-strong) bg-(--background-subtle) px-1.5 font-medium font-mono text-(--foreground-muted) text-[10px] sm:flex">
					<span>⌘</span>K
				</kbd>
			</button>

			{wanted && (
				// A failed chunk leaves search unavailable rather than taking the
				// page down with it; React caches the rejection until a reload.
				<CatchBoundary getResetKey={() => 0} errorComponent={() => null}>
					<Suspense fallback={null}>
						<SearchCommandDialog open={open} onOpenChange={onOpenChange} />
					</Suspense>
				</CatchBoundary>
			)}
		</>
	);
}

export default SearchCommand;
