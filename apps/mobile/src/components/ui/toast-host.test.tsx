import { type ReactNode, useCallback, useState } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, expect, it } from "vitest";
import { ToastHost, ToastHostContext } from "./toast-host";

let view: ReactTestRenderer;
afterEach(() => act(() => view.unmount()));

const RootStack = "root-stack" as unknown as (props: {
	children: ReactNode;
}) => ReactNode;
const SheetOne = "sheet-one" as unknown as typeof RootStack;
const SheetTwo = "sheet-two" as unknown as typeof RootStack;

let setOpen: (open: number) => void;
function App() {
	const [hosts, setHosts] = useState<string[]>([]);
	const [open, setOpenState] = useState(0);
	setOpen = setOpenState;
	const topHost = hosts.at(-1) ?? null;
	const register = useCallback((id: string) => {
		setHosts((current) => [...current, id]);
		return () => setHosts((current) => current.filter((h) => h !== id));
	}, []);
	return (
		<ToastHostContext.Provider
			value={{
				register,
				topHost,
				stack: "toast",
			}}
		>
			{topHost ? null : <RootStack>toast</RootStack>}
			{open >= 1 ? (
				<SheetOne>
					<ToastHost />
				</SheetOne>
			) : null}
			{open >= 2 ? (
				<SheetTwo>
					<ToastHost />
				</SheetTwo>
			) : null}
		</ToastHostContext.Provider>
	);
}

function where() {
	return ["root-stack", "sheet-one", "sheet-two"].filter((type) =>
		view.root
			.findAllByType(type as never)
			.some(
				(node) =>
					node.findAll((child) => child.children.includes("toast" as never))
						.length > 0,
			),
	);
}

it("shows toasts in the newest open sheet, and in the root when none is", async () => {
	await act(async () => {
		view = create(<App />);
	});
	expect(where()).toEqual(["root-stack"]);
	await act(async () => setOpen(1));
	expect(where()).toEqual(["sheet-one"]);
	await act(async () => setOpen(2));
	expect(where()).toEqual(["sheet-two"]);
	await act(async () => setOpen(0));
	expect(where()).toEqual(["root-stack"]);
});
