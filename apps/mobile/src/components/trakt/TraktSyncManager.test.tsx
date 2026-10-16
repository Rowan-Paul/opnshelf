import { createRequire } from "node:module";
import { Modal, Pressable } from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterAll, afterEach, beforeEach, expect, it, vi } from "vitest";
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

const mocks = vi.hoisted(() => ({
	mutate: vi.fn(),
	active: false,
	issues: false,
	uncertain: false,
	syncState: "idle",
}));
vi.mock("@opnshelf/api", async (original) => ({
	...(await original<typeof import("@opnshelf/api")>()),
	traktSyncControllerMatchesOptions: () => ({}),
	traktSyncControllerResolveMutation: () => ({}),
	traktSyncControllerConnectMutation: () => ({}),
	traktSyncControllerActionMutation: () => ({}),
	traktSyncControllerConfigureMutation: () => ({}),
}));
vi.mock("@tanstack/react-query", () => ({
	useQuery: () => ({
		data: {
			configured: true,
			username: mocks.issues ? "fixture" : undefined,
			status: mocks.active ? "active" : "paused",
			syncState: mocks.syncState,
			direction: "both",
			watches: true,
			ratings: true,
			historyScope: "all",
			publicationConsent: mocks.active,
			importStatus: "paused",
			remaining: 0,
			needsAttention: mocks.issues ? 1 : 0,
			ignored: 0,
		},
	}),
	useInfiniteQuery: ({ queryKey }: { queryKey: string[] }) => ({
		data: {
			pages: [
				{
					items:
						queryKey.at(-1) === "ignored"
							? [
									{
										id: "one",
										kind: "watch",
										ignored: true,
										issue: "Ignored fixture",
										opnshelf: { title: "Fixture", displayValue: "2020-01-01" },
										candidates: [],
									},
								]
							: mocks.uncertain
								? [
										{
											id: "one",
											kind: "review",
											recovery: "verify",
											ignored: false,
											issue: "Unconfirmed creation",
											opnshelf: { title: "Fixture", displayValue: "Review" },
											candidates: [],
										},
									]
								: [],
					total: queryKey.at(-1) === "ignored" ? 1 : 0,
				},
			],
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
	StatusBar: { currentHeight: 0 },
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
	useSafeAreaInsets: () => ({ top: 0, bottom: 0 }),
}));
vi.mock("@/components/marks/TraktMark", () => ({ TraktMark: "icon" }));

beforeEach(() => {
	mocks.active = false;
	mocks.uncertain = false;
	mocks.issues = false;
	mocks.syncState = "idle";
});
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
	press("Choose records");
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

it("opens record choices separately and retains changes when closed", () => {
	mount();
	const notes = () =>
		renderer.root.findAll(
			(node) =>
				node.type === "switch" && node.props.accessibilityLabel === "Notes",
		);
	expect(notes()).toHaveLength(0);
	press("Choose records");
	act(() => notes()[0].props.onValueChange(true));
	press("Done");
	expect(notes()).toHaveLength(0);
	expect(
		renderer.root.findAll(
			(node) =>
				node.type === "text" &&
				node.props.children === "Watch history, Ratings, Notes",
		),
	).not.toHaveLength(0);
	press("Choose records");
	expect(notes()[0].props.value).toBe(true);
	expect(mocks.mutate).not.toHaveBeenCalled();
});

it("shows the running worker instead of offering another Sync now request", () => {
	mocks.active = true;
	mocks.syncState = "running";
	mount();
	const button = renderer.root.find(
		(node) =>
			node.type === "text" && node.props.children === "Syncing with Trakt…",
	).parent;
	expect(button?.props.disabled).toBe(true);
});

it("opens ignored items in a sheet and restores without replacing attention", () => {
	mocks.issues = true;
	mount();
	press("View ignored");
	expect(
		renderer.root.findAllByType(Modal).filter((node) => node.props.visible),
	).toHaveLength(1);
	expect(
		renderer.root.findAll(
			(node) =>
				node.type === "text" && node.props.children === "Needs attention",
		),
	).toHaveLength(1);
	press("Restore item");
	expect(mocks.mutate).toHaveBeenCalledWith({
		path: { id: "one" },
		body: { action: "undo" },
	});
	press("Done");
	expect(
		renderer.root.findAllByType(Modal).filter((node) => node.props.visible),
	).toHaveLength(0);
	expect(
		renderer.root.findAll(
			(node) =>
				node.type === "text" && node.props.children === "Needs attention",
		),
	).toHaveLength(1);
});

it.each([
	"Send after checking Trakt…",
	"Remove from Opnshelf…",
])("requires a Trakt check before %s", (label) => {
	mocks.active = true;
	mocks.issues = true;
	mocks.uncertain = true;
	mount();
	press(label);
	const confirm = () =>
		renderer.root.find(
			(node) =>
				node.type === "text" && node.props.children === "Confirm choice",
		).parent;
	expect(confirm()?.props.disabled).toBe(true);
	expect(mocks.mutate).not.toHaveBeenCalled();
	const toggle = renderer.root.find(
		(node) =>
			node.type === "switch" &&
			node.props.accessibilityLabel ===
				"I checked Trakt and confirmed this item is missing.",
	);
	act(() => toggle.props.onValueChange(true));
	expect(confirm()?.props.disabled).toBe(false);
	press("Confirm choice");
	expect(mocks.mutate).toHaveBeenCalledWith({
		path: { id: "one" },
		body: {
			action: label.startsWith("Send") ? "opnshelf" : "trakt",
			confirmedTraktMissing: true,
		},
	});
});
