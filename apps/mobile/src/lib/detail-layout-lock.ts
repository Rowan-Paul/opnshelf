import { createContext, useContext, useEffect } from "react";

/** Detail sheets keep their owning subtree in place until they are dismissed. */
export const DetailLayoutLock = createContext<() => () => void>(() => () => {});

export function useDetailLayoutLock(visible: boolean) {
	const lock = useContext(DetailLayoutLock);
	useEffect(() => (visible ? lock() : undefined), [visible, lock]);
}
