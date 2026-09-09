import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { WelcomeStep } from "./WelcomeStep";

it("greets the user and advances on Get Started", () => {
	const onNext = vi.fn();
	render(<WelcomeStep onNext={onNext} />);

	expect(
		screen.getByRole("heading", { name: "Welcome to Opnshelf" }),
	).toBeTruthy();

	fireEvent.click(screen.getByRole("button", { name: /get started/i }));
	expect(onNext).toHaveBeenCalledOnce();
});
