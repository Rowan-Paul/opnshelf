import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import EpisodeRow from "./EpisodeRow";

vi.mock("@tanstack/react-router", () => ({
	Link: ({
		to,
		children,
		...props
	}: { to: string; children: React.ReactNode } & Record<string, unknown>) => (
		<a href={to} {...props}>
			{children}
		</a>
	),
}));

vi.mock("#/lib/auth-context", () => ({
	useAuth: () => ({ userSettings: undefined }),
}));

function renderRow(isWatched: boolean) {
	const onMarkWatched = vi.fn();
	const onUnmarkWatched = vi.fn();
	render(
		<EpisodeRow
			episode={{ id: 7, episode_number: 2, name: "Pilot", runtime: 30 }}
			showId="1399"
			showName="local-fixture-show"
			seasonNumber={1}
			isWatched={isWatched}
			isUpNext={false}
			isProcessing={false}
			isUnmarking={false}
			onMarkWatched={onMarkWatched}
			onUnmarkWatched={onUnmarkWatched}
		/>,
	);
	return { onMarkWatched, onUnmarkWatched };
}

describe("EpisodeRow", () => {
	it("keeps the shelf button outside the episode link", () => {
		const { onMarkWatched } = renderRow(false);

		const link = screen.getByRole("link", { name: "Pilot" });
		const button = screen.getByRole("button", { name: "Add to shelf: Pilot" });
		expect(link.contains(button)).toBe(false);
		expect(button.closest("a")).toBeNull();

		fireEvent.click(button);
		expect(onMarkWatched).toHaveBeenCalledOnce();
	});

	it("names the watched-state button with its episode", () => {
		const { onUnmarkWatched } = renderRow(true);

		const button = screen.getByRole("button", { name: "On shelf: Pilot" });
		expect(button.closest("a")).toBeNull();

		fireEvent.click(button);
		expect(onUnmarkWatched).toHaveBeenCalledOnce();
	});
});
