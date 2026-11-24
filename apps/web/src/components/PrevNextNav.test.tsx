import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PrevNextNav } from "./PrevNextNav";

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

describe("PrevNextNav", () => {
	it("renders both neighbours with their codes", () => {
		render(
			<PrevNextNav
				previous={{ label: "Previous season", code: "S1", href: "/s/1" }}
				next={{ label: "Next season", code: "S3", href: "/s/3" }}
			/>,
		);
		expect(
			screen
				.getByRole("link", { name: "Previous season, S1" })
				.getAttribute("href"),
		).toBe("/s/1");
		expect(
			screen
				.getByRole("link", { name: "Next season, S3" })
				.getAttribute("href"),
		).toBe("/s/3");
	});

	it("leaves out the side with no neighbour", () => {
		render(
			<PrevNextNav
				next={{ label: "Next episode", code: "S1E2", href: "/e/2" }}
			/>,
		);
		expect(screen.getAllByRole("link")).toHaveLength(1);
		expect(
			screen.getByRole("link", { name: "Next episode, S1E2" }),
		).toBeTruthy();
		expect(screen.getByText("S1E2")).toBeTruthy();
	});

	it("renders nothing without neighbours", () => {
		const { container } = render(<PrevNextNav />);
		expect(container.innerHTML).toBe("");
	});
});
