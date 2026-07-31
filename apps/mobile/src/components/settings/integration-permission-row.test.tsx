import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IntegrationPermissionRow } from "./integration-permission-row";

const mocks = vi.hoisted(() => ({ showDialog: vi.fn() }));

vi.mock("@/components/ui/dialog", () => ({
	useDialog: () => ({ showDialog: mocks.showDialog }),
}));

vi.mock("react-native", async () => {
	const { createElement } = await import("react");
	return {
		Pressable: (props: Record<string, unknown>) =>
			createElement("pressable", props, props.children as never),
		View: (props: Record<string, unknown>) =>
			createElement("view", props, props.children as never),
	};
});

vi.mock("@/components/ui/text", async () => {
	const { createElement } = await import("react");
	return {
		Text: (props: Record<string, unknown>) =>
			createElement("text", props, props.children as never),
	};
});

describe("IntegrationPermissionRow", () => {
	beforeEach(() => vi.clearAllMocks());

	it("warns before connecting and confirms through the native dialog", () => {
		const onConfirm = vi.fn();
		let renderer!: ReactTestRenderer;
		act(() => {
			renderer = create(
				<IntegrationPermissionRow
					name="Blog mirroring"
					description="Publish selected Reviews to your blog."
					connected={false}
					onConfirm={onConfirm}
				/>,
			);
		});

		act(() => {
			renderer.root
				.findByProps({ accessibilityLabel: "Connect Blog mirroring" })
				.props.onPress();
		});

		const dialog = mocks.showDialog.mock.calls[0]?.[0];
		expect(dialog.description).toContain(
			"Other devices will need to sign in again",
		);
		act(() => dialog.actions.at(-1).onPress());
		expect(onConfirm).toHaveBeenCalledWith("connect");
	});
});
