import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { IntegrationPermissionRow } from "./IntegrationPermissionRow";

describe("IntegrationPermissionRow", () => {
	it.each([
		[false, "Connect Bluesky Cross-posts", "connect"],
		[true, "Disconnect Bluesky Cross-posts", "disconnect"],
	] as const)("hands the press straight to the Permission Explainer (connected: %s)", (connected, label, action) => {
		const onRequest = vi.fn();
		render(
			<IntegrationPermissionRow
				name="Bluesky Cross-posts"
				description="Publish selected reviews to your Bluesky profile."
				connected={connected}
				onRequest={onRequest}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: label }));

		expect(onRequest).toHaveBeenCalledWith(action);
	});
});
