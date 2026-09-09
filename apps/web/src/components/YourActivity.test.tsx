import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { YourActivity } from "./YourActivity";

vi.mock("#/lib/auth-context", () => ({
	useAuth: () => ({ userSettings: undefined }),
}));

function renderActivity(entryCount: number) {
	render(
		<YourActivity
			watchHistory={Array.from({ length: entryCount }, (_, i) => ({
				id: `watch-${i}`,
				watchedDate: "2026-08-15T10:53:00.000Z",
			}))}
			onAddToShelf={vi.fn()}
			onDeleteEntry={vi.fn()}
		/>,
	);
}

describe("YourActivity Watch count", () => {
	it("states the total when a title was watched more than once", () => {
		renderActivity(3);

		expect(screen.getByLabelText("3 watches logged").textContent).toContain(
			"3",
		);
	});

	it("badges a single Watch without a redundant number", () => {
		renderActivity(1);

		expect(screen.getByLabelText("1 watch logged").textContent).toBe("");
	});

	it("shows no badge before anything is watched", () => {
		renderActivity(0);

		expect(screen.queryByLabelText(/watch(es)? logged/)).toBeNull();
	});
});
