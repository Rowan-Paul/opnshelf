import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useState,
} from "react";

interface SearchDialogContextValue {
	open: boolean;
	setOpen: (open: boolean) => void;
	toggle: () => void;
}

const SearchDialogContext = createContext<SearchDialogContextValue | null>(
	null,
);

export function SearchDialogProvider({ children }: { children: ReactNode }) {
	const [open, setOpen] = useState(false);
	const toggle = useCallback(() => setOpen((prev) => !prev), []);

	return (
		<SearchDialogContext.Provider value={{ open, setOpen, toggle }}>
			{children}
		</SearchDialogContext.Provider>
	);
}

export function useSearchDialog() {
	const ctx = useContext(SearchDialogContext);
	if (!ctx) {
		throw new Error("useSearchDialog must be used within SearchDialogProvider");
	}
	return ctx;
}
