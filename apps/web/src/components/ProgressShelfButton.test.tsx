import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProgressShelfButton } from "./ProgressShelfButton";

vi.mock("#/lib/auth-context", () => ({
	useAuth: () => ({ userSettings: { timezone: "Europe/Amsterdam" } }),
}));

function renderButton(
	props: Partial<Parameters<typeof ProgressShelfButton>[0]> = {},
) {
	const onMarkWatched = vi.fn();
	const onUnmarkWatched = vi.fn();

	const result = render(
		<ProgressShelfButton
			episodesWatched={0}
			episodesTotal={10}
			onMarkWatched={onMarkWatched}
			onUnmarkWatched={onUnmarkWatched}
			{...props}
		/>,
	);

	return { ...result, onMarkWatched, onUnmarkWatched };
}

describe("ProgressShelfButton", () => {
	it("hides itself when the show has no aired episodes", () => {
		const { container } = renderButton({ episodesTotal: 0 });

		expect(container.innerHTML).toBe("");
	});

	it.each([
		["unwatched", 0],
		["partially watched", 4],
	])("marks remaining episodes when %s", (_case, episodesWatched) => {
		const { onMarkWatched, onUnmarkWatched } = renderButton({
			episodesWatched,
		});

		fireEvent.click(screen.getByRole("button", { name: /add to shelf/i }));

		expect(onMarkWatched).toHaveBeenCalledOnce();
		expect(onUnmarkWatched).not.toHaveBeenCalled();
	});

	it("unmarks once every episode is watched", () => {
		const { onMarkWatched, onUnmarkWatched } = renderButton({
			episodesWatched: 10,
		});

		fireEvent.click(screen.getByRole("button", { name: /remove from shelf/i }));

		expect(onUnmarkWatched).toHaveBeenCalledOnce();
		expect(onMarkWatched).not.toHaveBeenCalled();
	});

	it("treats extra watches as complete", () => {
		renderButton({ episodesWatched: 12 });

		expect(
			screen.getByRole("button", { name: /remove from shelf/i }),
		).toBeTruthy();
	});

	it("uses the supplied labels", () => {
		renderButton({
			episodesWatched: 4,
			markLabel: "Mark remaining watched",
		});

		expect(
			screen.getByRole("button", { name: "Mark remaining watched" }),
		).toBeTruthy();
	});

	it.each([
		["a mark is in flight", { isMarkPending: true }],
		["an unmark is in flight", { isUnmarkPending: true }],
		["the season is processing", { processing: true }],
	])("disables the button while %s", (_case, pendingProps) => {
		const { onMarkWatched } = renderButton(pendingProps);

		const button = screen.getByRole("button", { name: /loading/i });
		expect(button.hasAttribute("disabled")).toBe(true);

		fireEvent.click(button);
		expect(onMarkWatched).not.toHaveBeenCalled();
	});

	describe("watch date picker", () => {
		it.each([
			["unwatched", 0, "Add to shelf"],
			// Futurama's shape: some episodes logged, more still to mark.
			["partially watched", 4, "Add to shelf"],
		])("opens the picker from the mark button when %s", (_case, episodesWatched, label) => {
			const { onMarkWatched } = renderButton({
				episodesWatched,
				onMarkWatchedAt: vi.fn(),
			});

			fireEvent.click(screen.getByRole("button", { name: label }));

			expect(screen.getByRole("button", { name: "No date" })).toBeTruthy();
			// Opening the picker must not log a Watch on its own.
			expect(onMarkWatched).not.toHaveBeenCalled();
		});

		it("creates undated Watches when the user picks No date", () => {
			const onMarkWatchedAt = vi.fn();
			renderButton({ episodesWatched: 4, onMarkWatchedAt });

			fireEvent.click(screen.getByRole("button", { name: "Add to shelf" }));
			fireEvent.click(screen.getByRole("button", { name: "No date" }));

			expect(onMarkWatchedAt).toHaveBeenCalledWith(null);
		});

		it("unmarks directly once every episode is watched", () => {
			// A date is meaningless next to "Remove from shelf".
			const { onUnmarkWatched } = renderButton({
				episodesWatched: 10,
				onMarkWatchedAt: vi.fn(),
			});

			fireEvent.click(
				screen.getByRole("button", { name: /remove from shelf/i }),
			);

			expect(onUnmarkWatched).toHaveBeenCalledOnce();
			expect(screen.queryByRole("button", { name: "No date" })).toBeNull();
		});

		it("marks on click when no date handler is supplied", () => {
			const { onMarkWatched } = renderButton({ episodesWatched: 4 });

			fireEvent.click(screen.getByRole("button", { name: /add to shelf/i }));

			expect(onMarkWatched).toHaveBeenCalledOnce();
			expect(screen.queryByRole("button", { name: "No date" })).toBeNull();
		});

		it("does not open the picker while a mark is in flight", () => {
			renderButton({
				episodesWatched: 4,
				isMarkPending: true,
				onMarkWatchedAt: vi.fn(),
			});

			const button = screen.getByRole("button", { name: /loading/i });
			expect(button.hasAttribute("disabled")).toBe(true);

			fireEvent.click(button);
			expect(screen.queryByRole("button", { name: "No date" })).toBeNull();
		});
	});
});
