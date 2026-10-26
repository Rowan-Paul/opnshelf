import { cleanup, render, screen } from "@testing-library/react";
import { StickyNote } from "lucide-react";
import { afterEach, describe, expect, it } from "vitest";
import { ContentState } from "./ContentState";

afterEach(cleanup);

describe("ContentState", () => {
	it("renders the empty message with its icon", () => {
		const { container } = render(
			<ContentState icon={StickyNote} message="No notes yet." />,
		);
		expect(screen.getByText("No notes yet.")).toBeTruthy();
		expect(container.querySelector("svg")).not.toBeNull();
		expect(screen.queryByRole("alert")).toBeNull();
	});

	it("announces the error variant with a destructive icon", () => {
		const { container } = render(
			<ContentState variant="error" message="Couldn't load notes." />,
		);
		expect(screen.getByRole("alert").textContent).toBe("Couldn't load notes.");
		expect(container.querySelector("svg.text-destructive")).not.toBeNull();
	});
});
