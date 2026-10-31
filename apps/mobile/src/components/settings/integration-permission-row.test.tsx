import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";
import { IntegrationPermissionRow } from "./integration-permission-row";

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
	it.each([
		[false, "Connect Blog mirroring", "connect"],
		[true, "Disconnect Blog mirroring", "disconnect"],
	] as const)("hands the press straight to the Permission Explainer (connected: %s)", (connected, label, action) => {
		const onRequest = vi.fn();
		let renderer!: ReactTestRenderer;
		act(() => {
			renderer = create(
				<IntegrationPermissionRow
					name="Blog mirroring"
					description="Publish selected Reviews to your blog."
					connected={connected}
					onRequest={onRequest}
				/>,
			);
		});

		act(() => {
			renderer.root.findByProps({ accessibilityLabel: label }).props.onPress();
		});

		expect(onRequest).toHaveBeenCalledWith(action);
	});
});
