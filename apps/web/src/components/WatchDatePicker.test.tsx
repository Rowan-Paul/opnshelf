import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WatchDatePicker } from "#/components/WatchDatePicker";

vi.mock("#/lib/auth-context", () => ({
	useAuth: () => ({ userSettings: { timezone: "Europe/Amsterdam" } }),
}));

function renderPicker(onConfirm: (watchedAt: string | null) => void) {
	render(
		<WatchDatePicker
			isPending={false}
			onConfirm={onConfirm}
			trigger={<button type="button">Add to shelf</button>}
		/>,
	);
	fireEvent.click(screen.getByRole("button", { name: "Add to shelf" }));
}

describe("WatchDatePicker", () => {
	it("creates an undated Watch when the user picks No date", () => {
		const onConfirm = vi.fn();
		renderPicker(onConfirm);

		fireEvent.click(screen.getByRole("button", { name: "No date" }));

		// null, not undefined: undefined would let the server stamp "now",
		// which is the thing an undated Watch exists to avoid.
		expect(onConfirm).toHaveBeenCalledWith(null);
	});

	it("submits No date on a single tap, without a second confirm", () => {
		const onConfirm = vi.fn();
		renderPicker(onConfirm);

		fireEvent.click(screen.getByRole("button", { name: "No date" }));

		expect(onConfirm).toHaveBeenCalledTimes(1);
		expect(screen.queryByRole("button", { name: "No date" })).toBeNull();
	});

	it("sends a UTC instant when the user confirms a date", () => {
		const onConfirm = vi.fn();
		renderPicker(onConfirm);

		fireEvent.change(screen.getByLabelText("When did you watch this?"), {
			target: { value: "2026-07-04T20:15" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

		// Europe/Amsterdam is UTC+2 in July.
		expect(onConfirm).toHaveBeenCalledWith("2026-07-04T18:15:00.000Z");
	});

	it("disables Confirm on an empty field instead of throwing", () => {
		const onConfirm = vi.fn();
		renderPicker(onConfirm);

		fireEvent.change(screen.getByLabelText("When did you watch this?"), {
			target: { value: "" },
		});

		const confirm = screen.getByRole("button", { name: "Confirm" });
		expect((confirm as HTMLButtonElement).disabled).toBe(true);

		// Clearing the field is not a second way to say "undated".
		fireEvent.click(confirm);
		expect(onConfirm).not.toHaveBeenCalled();
	});

	it("does not offer a future watch date", () => {
		renderPicker(vi.fn());

		const input = screen.getByLabelText(
			"When did you watch this?",
		) as HTMLInputElement;
		expect(input.max).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
	});
});
