import { createRequire } from "node:module";
import { Modal } from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterAll, afterEach, expect, it, vi } from "vitest";
import { TraktSyncManager } from "./TraktSyncManager";

const require = createRequire(import.meta.url);
const pngLoader = require.extensions[".png"];
require.extensions[".png"] = (module) => {
	// biome-ignore lint/suspicious/noExportsInTest: Stub Metro's image loader for the component's native require.
	module.exports = "icon.png";
};
afterAll(() => {
	if (pngLoader) require.extensions[".png"] = pngLoader;
	else delete require.extensions[".png"];
});

const mocks = vi.hoisted(() => ({ mutate: vi.fn() }));
vi.mock("@opnshelf/api", async (original) => ({
	...(await original<typeof import("@opnshelf/api")>()),
	traktSyncControllerConnectMutation: () => ({}),
	traktSyncControllerActionMutation: () => ({}),
	traktSyncControllerConfigureMutation: () => ({}),
}));
vi.mock("@tanstack/react-query", () => ({
	useQuery: () => ({
		data: {
			configured: true,
			status: "paused",
			direction: "both",
			watches: true,
			ratings: true,
			historyScope: "all",
			publicationConsent: false,
			importStatus: "paused",
			needsAttention: 0,
			ignored: 0,
		},
	}),
	useMutation: () => ({ mutate: mocks.mutate, isPending: false }),
	useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock("react-native", () => ({
	View: "view",
	Text: "text",
	Pressable: "pressable",
	ScrollView: "scrollview",
	Switch: "switch",
	TextInput: "input",
	Modal: "modal",
}));
vi.mock("expo-router", () => ({ Link: "link" }));
vi.mock("expo-image", () => ({ Image: "image" }));
vi.mock("expo-web-browser", () => ({}));
vi.mock("lucide-react-native", () => ({
	ArrowLeft: "icon",
	ArrowRight: "icon",
	ArrowLeftRight: "icon",
	X: "icon",
}));
vi.mock("react-native-safe-area-context", () => ({
	useSafeAreaInsets: () => ({ bottom: 0 }),
}));
vi.mock("@/components/marks/TraktMark", () => ({ TraktMark: "icon" }));

let renderer: ReactTestRenderer;
afterEach(() => {
	act(() => renderer.unmount());
	vi.clearAllMocks();
});
function mount() {
	act(() => {
		renderer = create(<TraktSyncManager embedded />);
	});
}
function press(label: string) {
	const button = renderer.root.find(
		(node) => node.type === "text" && node.props.children === label,
	).parent;
	act(() => button?.props.onPress());
}

it("allows disconnecting before setup without enabling sync", () => {
	mount();
	press("Disconnect");
	press("Confirm disconnect");
	expect(mocks.mutate).toHaveBeenCalledExactlyOnceWith(
		{ body: { action: "disconnect" } },
		expect.anything(),
	);
});

it("closes the confirmation sheet when navigating to finish an Import", () => {
	mount();
	press("Enable sync");
	expect(renderer.root.findByType(Modal).props.visible).toBe(true);
	const link = renderer.root.find(
		(node) =>
			node.type === "link" && node.props.children === "Finish Import first",
	);
	expect(link.props.href).toBe("/trakt-import");
	act(() => link.props.onPress?.());
	expect(renderer.root.findByType(Modal).props.visible).toBe(false);
	expect(mocks.mutate).not.toHaveBeenCalled();
});
