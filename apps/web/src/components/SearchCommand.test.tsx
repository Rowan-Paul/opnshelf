import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import SearchCommand from "./SearchCommand";

vi.mock("./SearchCommandDialog", () => {
	throw new TypeError(
		"error loading dynamically imported module: /assets/SearchCommandDialog-old.js",
	);
});
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});
it("offers a document reload after a failed search import", async () => {
	const reload = vi.fn();
	vi.stubGlobal("window", { location: { reload } });
	const log = vi.spyOn(console, "error").mockImplementation(() => {});
	try {
		render(<SearchCommand open={true} onOpenChange={vi.fn()} />);
		fireEvent.click(
			await screen.findByRole("button", { name: "Reload to search" }),
		);
		expect(reload).toHaveBeenCalledOnce();
	} finally {
		log.mockRestore();
	}
});

it("handles failed speculative hover and focus imports without opening search", async () => {
	render(<SearchCommand open={false} onOpenChange={vi.fn()} />);
	const button = screen.getByRole("button", { name: "Search" });
	fireEvent.pointerEnter(button);
	fireEvent.focus(button);
	await vi.dynamicImportSettled();
	expect(screen.queryByRole("button", { name: "Reload to search" })).toBeNull();
});

function ControlledSearch() {
	const [open, setOpen] = useState(false);
	return <SearchCommand open={open} onOpenChange={setOpen} />;
}
it.each([
	"metaKey",
	"ctrlKey",
])("reloads with %s+K after a failed keyboard open and focuses recovery", async (modifier) => {
	const reload = vi.fn();
	vi.stubGlobal("window", { location: { reload } });
	const log = vi.spyOn(console, "error").mockImplementation(() => {});
	try {
		render(<ControlledSearch />);
		fireEvent.keyDown(document, { key: "k", [modifier]: true });
		const recovery = await screen.findByRole("button", {
			name: "Reload to search",
		});
		expect(document.activeElement).toBe(recovery);
		expect(reload).not.toHaveBeenCalled();
		fireEvent.keyDown(document, { key: "k", [modifier]: true });
		expect(reload).toHaveBeenCalledOnce();
	} finally {
		log.mockRestore();
	}
});
it("offers reload when a failed preload is followed by a click", async () => {
	const log = vi.spyOn(console, "error").mockImplementation(() => {});
	try {
		render(<ControlledSearch />);
		const button = screen.getByRole("button", { name: "Search" });
		fireEvent.pointerEnter(button);
		await vi.dynamicImportSettled();
		fireEvent.click(button);
		expect(
			await screen.findByRole("button", { name: "Reload to search" }),
		).toBeTruthy();
	} finally {
		log.mockRestore();
	}
});
