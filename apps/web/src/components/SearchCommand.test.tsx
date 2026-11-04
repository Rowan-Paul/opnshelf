import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
