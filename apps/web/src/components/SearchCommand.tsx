import { CatchBoundary } from "@tanstack/react-router";
import { RefreshCw, Search } from "lucide-react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";

// cmdk, the dialog, and the search queries load in their own chunk the first
// time search is wanted, so they stay off every page's first load.
const loadDialog = () => import("./SearchCommandDialog");
const SearchCommandDialog = lazy(loadDialog);
// A speculative import must not become an unhandled rejection. Opening search
// still surfaces a failure through its boundary and offers a document reload.
const preloadDialog = () => {
	void loadDialog().catch(() => {});
};

interface SearchCommandProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function SearchCommand({ open, onOpenChange }: SearchCommandProps) {
	// Stays mounted after the first open so closing keeps its exit animation.
	const [wanted, setWanted] = useState(open);
	const [failed, setFailed] = useState(false);
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
				onClick={() => (failed ? window.location.reload() : onOpenChange(true))}
				onPointerEnter={preloadDialog}
				onFocus={preloadDialog}
				className="group flex h-9 items-center gap-2 rounded-md border border-(--border) bg-(--background-elevated) px-3 text-(--foreground-muted) transition-colors hover:border-(--border-strong) hover:bg-(--background-subtle) hover:text-(--foreground)"
				aria-label={failed ? "Reload to search" : "Search"}
				data-tour="command"
			>
				{failed ? (
					<RefreshCw className="size-4" />
				) : (
					<Search className="size-4" />
				)}
				<span className="hidden text-sm sm:inline">
					{failed ? "Reload to search" : "Search"}
				</span>
				<kbd className="ml-1 hidden h-5 select-none items-center gap-0.5 rounded border border-(--border-strong) bg-(--background-subtle) px-1.5 font-medium font-mono text-(--foreground-muted) text-[10px] sm:flex">
					<span>⌘</span>K
				</kbd>
			</button>

			{wanted && (
				// React caches a lazy import rejection until the document reloads.
				<CatchBoundary
					getResetKey={() => 0}
					onCatch={() => setFailed(true)}
					errorComponent={SearchLoadError}
				>
					<Suspense fallback={null}>
						<SearchCommandDialog open={open} onOpenChange={onOpenChange} />
					</Suspense>
				</CatchBoundary>
			)}
		</>
	);
}

function SearchLoadError() {
	return null;
}

export default SearchCommand;
