import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReviewLikeButton } from "./ReviewLikeButton";

afterEach(cleanup);

const base = {
	likeCount: 3,
	isLiked: false,
	canLike: true,
	isAuthenticated: true,
	isPending: false,
};

describe("ReviewLikeButton", () => {
	it("toggles for a signed-in viewer who can like", () => {
		const onToggle = vi.fn();
		render(<ReviewLikeButton {...base} onToggle={onToggle} />);
		fireEvent.click(screen.getByLabelText("Like review"));
		expect(onToggle).toHaveBeenCalledTimes(1);
	});

	it("labels the toggle Unlike when already liked", () => {
		render(<ReviewLikeButton {...base} isLiked onToggle={vi.fn()} />);
		expect(screen.getByLabelText("Unlike review")).toBeTruthy();
	});

	it("shows signed-out viewers a read-only count", () => {
		const onToggle = vi.fn();
		render(
			<ReviewLikeButton
				{...base}
				canLike={false}
				isAuthenticated={false}
				onToggle={onToggle}
			/>,
		);
		const button = screen.getByLabelText("3 likes") as HTMLButtonElement;
		expect(button.disabled).toBe(true);
		expect(button.textContent).toContain("3");
		fireEvent.click(button);
		expect(onToggle).not.toHaveBeenCalled();
	});

	it("ignores clicks while a like is in flight", () => {
		const onToggle = vi.fn();
		render(<ReviewLikeButton {...base} isPending onToggle={onToggle} />);
		fireEvent.click(screen.getByLabelText("Like review"));
		expect(onToggle).not.toHaveBeenCalled();
	});

	it("holds the count's place while it loads", () => {
		const { container } = render(
			<ReviewLikeButton {...base} likeCount={undefined} onToggle={vi.fn()} />,
		);
		expect(container.querySelector(".animate-pulse")).not.toBeNull();
	});
});
