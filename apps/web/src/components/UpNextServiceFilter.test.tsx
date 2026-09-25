import { streamingServicesControllerListOptions } from "@opnshelf/api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UpNextServiceFilter } from "./UpNextServiceFilter";

function setup(value?: string, savedIds = [8], needsSelection = false) {
	const client = new QueryClient({
		defaultOptions: { queries: { staleTime: Infinity } },
	});
	client.setQueryData(
		streamingServicesControllerListOptions({ query: { country: "NL" } })
			.queryKey,
		{
			country: "NL",
			services: [
				{ id: 8, name: "Netflix", logoUrl: null, displayPriority: 1 },
				{ id: 350, name: "Apple TV", logoUrl: null, displayPriority: 2 },
			],
		},
	);
	const onChange = vi.fn();
	render(
		<QueryClientProvider client={client}>
			<UpNextServiceFilter
				country="NL"
				savedIds={savedIds}
				value={value}
				needsSelection={needsSelection}
				onChange={onChange}
			/>
		</QueryClientProvider>,
	);
	if (!needsSelection)
		fireEvent.click(screen.getByRole("button", { name: "Streaming services" }));
	return { onChange, dialog: within(screen.getByRole("dialog")) };
}

describe.each([
	"desktop",
	"mobile",
])("Up Next service filter on %s", (viewport) => {
	beforeEach(() => {
		vi.stubGlobal(
			"matchMedia",
			vi.fn(() => ({
				matches: viewport === "mobile",
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
			})),
		);
	});
	afterEach(() => vi.unstubAllGlobals());
	it("opens an empty legacy selection automatically and allows cancellation", () => {
		const { onChange, dialog } = setup("mine", [], true);
		fireEvent.click(dialog.getByRole("button", { name: "Cancel" }));
		expect(screen.queryByRole("dialog")).toBeNull();
		expect(onChange).not.toHaveBeenCalled();
	});
	it("adds a service outside My Services and only applies on confirmation", () => {
		const { onChange, dialog } = setup("mine");
		fireEvent.click(dialog.getByRole("button", { name: "Apple TV" }));
		expect(onChange).not.toHaveBeenCalled();
		fireEvent.click(dialog.getByRole("button", { name: "Apply filter" }));
		expect(onChange).toHaveBeenCalledWith("8,350");
	});
	it("discards edits on cancel and restores the applied selection when reopened", () => {
		const { onChange, dialog } = setup("mine");
		fireEvent.click(dialog.getByRole("button", { name: "Apple TV" }));
		fireEvent.click(dialog.getByRole("button", { name: "Cancel" }));
		expect(onChange).not.toHaveBeenCalled();
		fireEvent.click(
			screen.getByRole("button", {
				name: "Streaming services",
			}),
		);
		expect(
			screen
				.getByRole("button", { name: "Apple TV" })
				.getAttribute("aria-pressed"),
		).toBe("false");
	});
	it("supports custom services without any saved subscriptions", () => {
		const { onChange, dialog } = setup(undefined, []);
		fireEvent.click(dialog.getByRole("button", { name: "Apple TV" }));
		fireEvent.click(dialog.getByRole("button", { name: "Apply filter" }));
		expect(onChange).toHaveBeenCalledWith("350");
	});
	it("clears the active selection from the clear button", () => {
		const { onChange, dialog } = setup("8,350");
		fireEvent.click(dialog.getByRole("button", { name: "Cancel" }));
		expect(screen.queryByRole("button", { name: "All" })).toBeNull();
		expect(screen.queryByRole("button", { name: "My Services" })).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
		expect(onChange).toHaveBeenLastCalledWith(undefined);
	});
});
