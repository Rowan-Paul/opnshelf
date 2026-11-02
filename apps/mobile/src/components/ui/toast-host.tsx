import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useId,
} from "react";

/**
 * Where the stack renders. A Modal covers the root view, so an open sheet
 * hosts the toasts inside its own window; the newest host shows them, and the
 * root does when none is mounted.
 */
export const ToastHostContext = createContext<{
	register: (id: string) => () => void;
	topHost: string | null;
	stack: ReactNode;
} | null>(null);

/** Shows the toast stack inside a Modal, above its dimmed backdrop. */
export function ToastHost() {
	const id = useId();
	const host = useContext(ToastHostContext);
	const register = host?.register;
	useEffect(() => register?.(id), [register, id]);
	return host?.topHost === id ? host.stack : null;
}
