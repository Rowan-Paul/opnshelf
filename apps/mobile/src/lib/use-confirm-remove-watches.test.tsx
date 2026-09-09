import type { ReactNode } from "react";
import { act, create } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useConfirmRemoveWatches } from "./use-confirm-remove-watches";

type DialogOptions = {
	title: string;
	description?: string;
	actions: { label: string; variant?: string; onPress?: () => void }[];
};

const dialog = vi.hoisted(() => ({ showDialog: vi.fn() }));

vi.mock("@/components/ui/dialog", () => ({
	useDialog: () => ({ showDialog: dialog.showDialog }),
}));

function renderHook() {
	// Held on an object, not a plain `let`: TypeScript does not track the
	// assignment made inside the component, and narrows a `let` to never.
	const rendered: { confirm?: ReturnType<typeof useConfirmRemoveWatches> } = {};

	function TestComponent(): ReactNode {
		rendered.confirm = useConfirmRemoveWatches();
		return null;
	}

	act(() => {
		create(<TestComponent />);
	});

	const confirm = rendered.confirm;
	if (!confirm) throw new Error("hook did not render");
	return confirm;
}

const lastDialog = () =>
	dialog.showDialog.mock.calls.at(-1)?.[0] as DialogOptions;

beforeEach(() => {
	dialog.showDialog.mockClear();
});

describe("useConfirmRemoveWatches", () => {
	it("removes a single Watch without asking", () => {
		const confirm = renderHook();
		const onConfirm = vi.fn();

		act(() => {
			confirm({ title: "Heat", entryCount: 1, onConfirm });
		});

		expect(onConfirm).toHaveBeenCalledTimes(1);
		expect(dialog.showDialog).not.toHaveBeenCalled();
	});

	it("asks before removing several Watches and names the count", () => {
		const confirm = renderHook();
		const onConfirm = vi.fn();

		act(() => {
			confirm({ title: "Heat", entryCount: 3, onConfirm });
		});

		expect(onConfirm).not.toHaveBeenCalled();
		expect(lastDialog().title).toBe("Remove all watches?");
		expect(lastDialog().description).toContain("all 3 watches of Heat");
	});

	it("removes every Watch once the destructive action is taken", () => {
		const confirm = renderHook();
		const onConfirm = vi.fn();

		act(() => {
			confirm({ title: "Heat", entryCount: 3, onConfirm });
		});
		const removeAll = lastDialog().actions.find(
			(action) => action.label === "Remove all",
		);

		expect(removeAll?.variant).toBe("destructive");
		act(() => {
			removeAll?.onPress?.();
		});
		expect(onConfirm).toHaveBeenCalledTimes(1);
	});

	it("keeps a cancel action that removes nothing", () => {
		const confirm = renderHook();
		const onConfirm = vi.fn();

		act(() => {
			confirm({ title: "Heat", entryCount: 2, onConfirm });
		});
		const cancel = lastDialog().actions.find(
			(action) => action.label === "Cancel",
		);

		expect(cancel).toBeDefined();
		expect(cancel?.onPress).toBeUndefined();
		expect(onConfirm).not.toHaveBeenCalled();
	});
});
