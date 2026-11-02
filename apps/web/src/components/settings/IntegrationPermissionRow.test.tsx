import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { IntegrationPermissionRow } from "./IntegrationPermissionRow";

describe("IntegrationPermissionRow", () => {
	it("explains what connecting allows before leaving for the account host", () => {
		const onConfirm = vi.fn();
		render(
			<IntegrationPermissionRow
				integration="bluesky"
				name="Bluesky Cross-posts"
				description="Publish selected reviews to your Bluesky profile."
				connected={false}
				onConfirm={onConfirm}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Connect" }));

		const dialog = screen.getByRole("dialog");
		expect(dialog.textContent).toContain("Let Opnshelf post to Bluesky");
		expect(dialog.textContent).toContain("Delete your Bluesky posts");
		expect(dialog.textContent).toContain(
			"Your other Devices will need to sign in again",
		);
		expect(onConfirm).not.toHaveBeenCalled();

		fireEvent.click(screen.getByRole("button", { name: "Not now" }));
		expect(onConfirm).not.toHaveBeenCalled();

		fireEvent.click(screen.getByRole("button", { name: "Connect" }));
		fireEvent.click(screen.getByRole("button", { name: "Continue" }));
		expect(onConfirm).toHaveBeenCalledWith("connect");
	});

	it("warns before disconnecting an account-wide integration", () => {
		const onConfirm = vi.fn();
		render(
			<IntegrationPermissionRow
				integration="bluesky"
				name="Bluesky Cross-posts"
				description="Publish selected reviews to your Bluesky profile."
				connected
				onConfirm={onConfirm}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Disconnect" }));

		expect(screen.getByRole("dialog").textContent).toContain(
			"Your other Devices will need to sign in again",
		);
		expect(onConfirm).not.toHaveBeenCalled();

		fireEvent.click(
			screen.getByRole("button", { name: "Continue and disconnect" }),
		);
		expect(onConfirm).toHaveBeenCalledWith("disconnect");
	});
});
