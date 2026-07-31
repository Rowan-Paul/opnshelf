import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { IntegrationPermissionRow } from "./IntegrationPermissionRow";

describe("IntegrationPermissionRow", () => {
	it("warns before disconnecting an account-wide integration", () => {
		const onConfirm = vi.fn();
		render(
			<IntegrationPermissionRow
				name="Bluesky Cross-posts"
				description="Publish selected reviews to your Bluesky profile."
				connected
				onConfirm={onConfirm}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Disconnect" }));

		expect(screen.getByRole("dialog").textContent).toContain(
			"Other devices will need to sign in again",
		);
		expect(onConfirm).not.toHaveBeenCalled();

		fireEvent.click(
			screen.getByRole("button", { name: "Continue and disconnect" }),
		);
		expect(onConfirm).toHaveBeenCalledWith("disconnect");
	});
});
