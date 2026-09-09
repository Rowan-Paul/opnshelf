import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SEARCH_TABS } from "#/lib/search-results";
import { SEARCH_TAB_OPTIONS, SearchTabs } from "./SearchTabs";

describe("SearchTabs", () => {
	it("offers exactly the known tabs, in display order", () => {
		expect(SEARCH_TAB_OPTIONS.map((t) => t.key)).toEqual([...SEARCH_TABS]);

		render(<SearchTabs activeTab="all" hidden={false} onChange={vi.fn()} />);
		expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual([
			"All",
			"Movies",
			"TV Shows",
			"Cast & Crew",
			"Users",
		]);
	});

	it("marks only the active tab pressed", () => {
		render(<SearchTabs activeTab="cast" hidden={false} onChange={vi.fn()} />);

		expect(screen.getByRole("button", { pressed: true }).textContent).toBe(
			"Cast & Crew",
		);
		expect(screen.getAllByRole("button", { pressed: false })).toHaveLength(4);
	});

	it("reports the clicked tab key", () => {
		const onChange = vi.fn();
		render(<SearchTabs activeTab="all" hidden={false} onChange={onChange} />);

		fireEvent.click(screen.getByRole("button", { name: "Users" }));
		expect(onChange).toHaveBeenCalledWith("people");
	});

	it("hides the bar on the discover state", () => {
		const { container } = render(
			<SearchTabs activeTab="all" hidden onChange={vi.fn()} />,
		);
		expect(container.firstElementChild?.classList.contains("hidden")).toBe(
			true,
		);
	});
});
