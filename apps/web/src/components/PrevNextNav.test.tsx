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

	it("hides the side with no neighbour and keeps the other on its edge", () => {
		render(
			<PrevNextNav
				next={{ label: "Next episode", code: "S1E2", href: "/e/2" }}
			/>,
		);
		expect(screen.getAllByRole("link")).toHaveLength(1);
		expect(screen.queryByText("Previous episode")).toBeNull();
		expect(
			screen.getByRole("link", { name: "Next episode, S1E2" }).className,
		).toContain("ml-auto");
	});

	it("renders nothing without neighbours", () => {
		const { container } = render(<PrevNextNav />);
		expect(container.innerHTML).toBe("");
	});
});
