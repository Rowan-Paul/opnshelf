import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
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

const rowProps: ComponentProps<typeof EpisodeRow> = {
	episode: { id: 7, episode_number: 2, name: "Pilot", runtime: 30 },
	showId: "1399",
	showName: "local-fixture-show",
	seasonNumber: 1,
	isWatched: false,
	isUpNext: false,
	isProcessing: false,
	isUnmarking: false,
	onMarkWatched: vi.fn(),
	onUnmarkWatched: vi.fn(),
};

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
	it.each([
		false,
		true,
	])("keeps the shelf action focusable and inert while pending (watched: %s)", (isWatched) => {
		const onMarkWatched = vi.fn();
		const onUnmarkWatched = vi.fn();
		const props = { ...rowProps, isWatched, onMarkWatched, onUnmarkWatched };
		const { rerender } = render(<EpisodeRow {...props} />);
		const button = screen.getByRole("button", {
			name: isWatched ? "On shelf: Pilot" : "Add to shelf: Pilot",
		});
		button.focus();
		rerender(
			<EpisodeRow
				{...props}
				isProcessing={!isWatched}
				isUnmarking={isWatched}
			/>,
		);
		// A native disabled button loses focus in Chromium. aria-disabled keeps
		// the same control in the keyboard order; the handler must block repeats.
		expect(button.hasAttribute("disabled")).toBe(false);
		expect(button.getAttribute("aria-disabled")).toBe("true");
		expect(button.getAttribute("aria-busy")).toBe("true");
		expect(button.textContent).toContain("Pilot");
		fireEvent.click(button);
		expect(onMarkWatched).not.toHaveBeenCalled();
		expect(onUnmarkWatched).not.toHaveBeenCalled();
		rerender(<EpisodeRow {...props} isWatched={!isWatched} />);
		const settledButton = screen.getByRole("button", {
			name: isWatched ? "Add to shelf: Pilot" : "On shelf: Pilot",
		});
		expect(settledButton).toBe(button);
		expect(document.activeElement).toBe(settledButton);
		expect(button.getAttribute("aria-disabled")).toBe("false");
		fireEvent.click(button);
		expect(isWatched ? onMarkWatched : onUnmarkWatched).toHaveBeenCalledOnce();
	});
});
