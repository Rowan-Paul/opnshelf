import { createRequire } from "node:module";
import { Modal, Pressable } from "react-native";
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
			remaining: 0,
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
	useWindowDimensions: () => ({ width: 390, height: 844, fontScale: 1 }),
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

it("selects one History option and includes it in the confirmation", () => {
	mount();
	const option = (label: string) =>
		renderer.root.find(
			(node) =>
				node.type === Pressable && node.props.accessibilityLabel === label,
		);
	const all = "All existing history and future changes";
	const future = "Future changes only";
	expect(option(all).props.accessibilityState.checked).toBe(true);
	expect(option(future).props.accessibilityState.checked).toBe(false);
	act(() => option(future).props.onPress());
	expect(option(all).props.accessibilityState.checked).toBe(false);
	expect(option(future).props.accessibilityState.checked).toBe(true);
	press("Enable sync");
	expect(
		renderer.root
			.findByType(Modal)
			.findAll(
				(node) => node.type === "text" && node.props.children === future,
			),
	).toHaveLength(1);
});

it("changes direction from a compact row before confirming", () => {
	mount();
	const option = (label: string) =>
		renderer.root.find(
			(node) =>
				node.type === Pressable && node.props.accessibilityLabel === label,
		);
	act(() => option("Opnshelf → Trakt").props.onPress());
	expect(option("Opnshelf → Trakt").props.accessibilityState.checked).toBe(
		true,
	);
	expect(option("Both directions").props.accessibilityState.checked).toBe(
		false,
	);
	press("Enable sync");
	expect(
		renderer.root
			.findByType(Modal)
			.findAll(
				(node) =>
					node.type === "text" && node.props.children === "Opnshelf → Trakt",
			),
	).toHaveLength(1);
	expect(mocks.mutate).not.toHaveBeenCalled();
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

it.each([
	"lists",
	"favorites",
	"notes",
	"library",
	"reviews",
] as const)("uses one publication acknowledgement for %s-only sync", (scope) => {
	mount();
	const toggle = (label: string, value: boolean) => {
		const control = renderer.root.find(
			(node) =>
				node.type === "switch" && node.props.accessibilityLabel === label,
		);
		act(() => control.props.onValueChange(value));
	};
	toggle("Watch history", false);
	toggle("Ratings", false);
	toggle(
		{
			lists: "Custom Lists",
			favorites: "Favorites",
			notes: "Notes",
			library: "Library",
			reviews: "Reviews",
		}[scope],
		true,
	);
	if (scope === "lists") toggle("Watchlist", true);
	press("Enable sync");
	const confirm = () =>
		renderer.root.find(
			(node) =>
				node.type === "text" &&
				node.props.children === "Confirm and enable sync",
		).parent;
	expect(confirm()?.props.disabled).toBe(true);
	expect(
		renderer.root.findAll(
			(node) =>
				node.type === "switch" &&
				node.props.accessibilityLabel.startsWith("I understand"),
		),
	).toHaveLength(1);
	const consent = renderer.root.find(
		(node) =>
			node.type === "switch" &&
			node.props.accessibilityLabel.startsWith("I understand that sync"),
	);
	act(() => consent.props.onValueChange(true));
	const handoff = renderer.root.find(
		(node) =>
			node.type === "switch" &&
			node.props.accessibilityLabel.startsWith("Continue my unfinished Import"),
	);
	act(() => handoff.props.onValueChange(true));
	expect(confirm()?.props.disabled).toBe(false);
	press("Confirm and enable sync");
	expect(mocks.mutate).toHaveBeenCalledWith({
		body: expect.objectContaining({
			watches: false,
			ratings: false,
			lists: scope === "lists",
			watchlist: scope === "lists",
			favorites: scope === "favorites",
			notes: scope === "notes",
			library: scope === "library",
			reviews: scope === "reviews",
			contentPublicationConsent: true,
			listPublicationConsent: true,
		}),
	});
});
