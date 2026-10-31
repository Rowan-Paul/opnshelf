import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IntegrationPermissionRow } from "./integration-permission-row";

const mocks = vi.hoisted(() => ({ showDialog: vi.fn() }));

vi.mock("lucide-react-native", () => ({
	Check: () => null,
	Laptop: () => null,
	X: () => null,
}));

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
		// The Button primitive picks its spinner tint from the scheme.
		useColorScheme: () => "light",
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

	it("explains the permission before connecting through the account host", async () => {
		const onConfirm = vi.fn();
		let renderer!: ReactTestRenderer;
		act(() => {
			renderer = create(
				<IntegrationPermissionRow
					integration="blog"
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
		expect(dialog.title).toBe("Let Opnshelf mirror Reviews to your blog");
		expect(dialog.description).toContain("sends you back here");
		expect(onConfirm).not.toHaveBeenCalled();
		// Continue resolves only once the modal has gone, before the browser opens.
		await act(async () => dialog.actions.at(-1).onDismiss());
		expect(onConfirm).toHaveBeenCalledWith("connect");
	});

	it("does not connect when the explanation is dismissed", async () => {
		const onConfirm = vi.fn();
		let renderer!: ReactTestRenderer;
		act(() => {
			renderer = create(
				<IntegrationPermissionRow
					integration="bluesky"
					name="Bluesky Cross-posts"
					description="Publish selected Reviews to Bluesky."
					connected={false}
					onConfirm={onConfirm}
				/>,
			);
		});

		act(() => {
			renderer.root
				.findByProps({ accessibilityLabel: "Connect Bluesky Cross-posts" })
				.props.onPress();
		});

		await act(async () => mocks.showDialog.mock.calls[0]?.[0].onCancel());
		expect(onConfirm).not.toHaveBeenCalled();
	});

	it("warns before disconnecting an account-wide integration", () => {
		const onConfirm = vi.fn();
		let renderer!: ReactTestRenderer;
		act(() => {
			renderer = create(
				<IntegrationPermissionRow
					integration="blog"
					name="Blog mirroring"
					description="Publish selected Reviews to your blog."
					connected
					onConfirm={onConfirm}
				/>,
			);
		});

		act(() => {
			renderer.root
				.findByProps({ accessibilityLabel: "Disconnect Blog mirroring" })
				.props.onPress();
		});

		const dialog = mocks.showDialog.mock.calls[0]?.[0];
		expect(dialog.description).toContain(
			"Your other Devices will need to sign in again",
		);
		act(() => dialog.actions.at(-1).onPress());
		expect(onConfirm).toHaveBeenCalledWith("disconnect");
	});
});
