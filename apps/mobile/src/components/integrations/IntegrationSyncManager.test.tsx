import { createRequire } from "node:module";
import { POPFEED_INTEGRATION, TRAKT_INTEGRATION } from "@opnshelf/api";
import { Modal, Pressable } from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterAll, afterEach, beforeEach, expect, it, vi } from "vitest";
import { IntegrationSyncManager } from "./IntegrationSyncManager";

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
	disconnected: false,
	issues: false,
	uncertain: false,
	candidate: false,
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
	keepPreviousData: (data: unknown) => data,
	useQuery: ({ queryKey }: { queryKey: string[] }) =>
		queryKey?.includes("issues")
			? {
					data: {
						items:
							queryKey.at(-2) === "ignored"
								? [
										{
											id: "one",
											kind: "watch",
											ignored: true,
											issue: "Ignored fixture",
											opnshelf: {
												title: "Fixture",
												mediaType: "episode",
												season: 2,
												episode: 3,
												displayValue: "2020-01-01",
											},
											candidates: [],
										},
									]
								: mocks.candidate
									? [
											{
												id: "one",
												kind: "watch",
												ignored: false,
												recovery: "retry",
												issue: "Possible duplicate",
												remote: {
													title: "Fixture",
													mediaType: "episode",
													season: 2,
													episode: 3,
													displayValue: "2026-10-18T19:55:00Z",
												},
												candidates: [
													{
														key: "existing",
														title: "Fixture",
														mediaType: "episode",
														season: 2,
														episode: 3,
														displayValue: "2026-10-18T19:53:00Z",
													},
												],
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
													opnshelf: {
														title: "Fixture",
														displayValue: "Review",
													},
													candidates: [],
												},
											]
										: [],
						total: queryKey.at(-2) === "ignored" || mocks.uncertain ? 1 : 0,
						page: 1,
						totalPages: 1,
						hasPreviousPage: false,
						hasNextPage: false,
					},
				}
			: {
					data: {
						configured: true,
						username: "fixture",
						status: mocks.disconnected
							? "disconnected"
							: mocks.active
								? "active"
								: "paused",
						syncState: mocks.syncState,
						direction: "both",
						watches: true,
						ratings: true,
						historyScope: "all",
						publicationConsent: mocks.active,
						remaining: 0,
						needsAttention: mocks.issues ? 1 : 0,
						ignored: 0,
					},
				},
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
vi.mock("@/lib/auth-context", () => ({
	useAuth: () => ({ runAuthorizationUrl: vi.fn() }),
}));
vi.mock("@/lib/auth-handoff", () => ({ beginHandoff: async () => null }));
const requestPermission = vi.hoisted(() => vi.fn(async () => false));
vi.mock("@/components/settings/permission-request", () => ({
	usePermissionRequest: () => requestPermission,
}));
vi.mock("@/components/integrations/IntegrationMark", () => ({
	IntegrationMark: "icon",
}));

beforeEach(() => {
	mocks.active = false;
	mocks.disconnected = false;
	mocks.uncertain = false;
	mocks.candidate = false;
	mocks.issues = false;
	mocks.syncState = "idle";
});
let renderer: ReactTestRenderer;
afterEach(() => {
	act(() => renderer.unmount());
	vi.clearAllMocks();
});
function mount(embedded = true, issuesOnly = false) {
	act(() => {
		renderer = create(
			<IntegrationSyncManager
				integration={TRAKT_INTEGRATION}
				embedded={embedded}
				issuesOnly={issuesOnly}
			/>,
		);
	});
}
function press(label: string) {
	const button = renderer.root.find(
		(node) => node.type === "text" && node.props.children === label,
	).parent;
	act(() => {
		button?.props.onPress();
	});
}

it("allows disconnecting before setup without enabling sync", () => {
	mount();
	press("Disconnect");
	expect(
		renderer.root.findAllByType(Modal).find((node) => node.props.visible)?.props
			.transparent,
	).toBe(true);
	const backdrop = renderer.root
		.findAllByType(Modal)
		.find((node) => node.props.visible)
		?.find(
			(node) =>
				node.type === Pressable &&
				node.props.accessibilityLabel === "Close confirmation",
		);
	act(() => backdrop?.props.onPress());
	expect(
		renderer.root.findAllByType(Modal).filter((node) => node.props.visible),
	).toHaveLength(0);
	expect(mocks.mutate).not.toHaveBeenCalled();
	press("Disconnect");
	press("Confirm disconnect");
	expect(mocks.mutate).toHaveBeenCalledExactlyOnceWith(
		"disconnect",
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
	expect(confirm()?.props.disabled).toBe(false);
	press("Confirm and enable sync");
	expect(mocks.mutate).toHaveBeenCalledWith(
		expect.objectContaining({
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
	);
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
	const status = renderer.root.find(
		(node) =>
			node.type === "text" &&
			node.props.children ===
				"Syncing with Trakt. You can keep using Opnshelf.",
	);
	expect(status.props.accessibilityLiveRegion).toBe("polite");
	expect(
		renderer.root.findAll(
			(node) =>
				node.type === "text" &&
				["Syncing with Trakt…", "Sync now"].includes(node.props.children),
		),
	).toHaveLength(0);
});

it("opens ignored items in a sheet and restores without replacing attention", () => {
	mocks.issues = true;
	mount(true, true);
	press("View ignored");
	expect(
		renderer.root.findAll(
			(node) => node.type === "text" && node.props.children === "Review item",
		),
	).toHaveLength(0);
	expect(
		renderer.root.findAll(
			(node) =>
				node.type === "text" && node.props.children === "Fixture · S2E3",
		),
	).toHaveLength(1);
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
	expect(mocks.mutate).toHaveBeenCalledWith({ action: "undo" });
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
	"Send after checking Trakt",
	"Remove from Opnshelf",
])("requires a Trakt check before %s", (label) => {
	mocks.active = true;
	mocks.issues = true;
	mocks.uncertain = true;
	mount(true, true);
	press(label);
	const modal = renderer.root.findByType(Modal);
	expect(modal.props.transparent).toBe(true);
	expect(modal.props.presentationStyle).toBeUndefined();
	const backdrop = renderer.root.find(
		(node) =>
			node.type === Pressable &&
			node.props.accessibilityLabel === "Close confirmation",
	);
	act(() => backdrop.props.onPress());
	expect(renderer.root.findAllByType(Modal)).toHaveLength(0);
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
		action: label.startsWith("Send") ? "opnshelf" : "remote",
		confirmedRemoteMissing: true,
	});
});

it.each([
	false,
	true,
])("hides empty attention when disconnected (embedded: %s)", (embedded) => {
	mocks.disconnected = true;
	mount(embedded);
	expect(
		renderer.root.findAll(
			(node) =>
				node.type === "text" && node.props.children === "Needs attention",
		),
	).toHaveLength(0);
});
it("keeps retained attention visible after disconnecting", () => {
	mocks.disconnected = true;
	mocks.issues = true;
	mount(false);
	expect(
		renderer.root.findAll(
			(node) =>
				node.type === "text" && node.props.children === "Needs attention",
		),
	).toHaveLength(1);
});

it("shows candidate details above a short link action", () => {
	mocks.candidate = true;
	mocks.issues = true;
	mount(true, true);
	const link = renderer.root.find(
		(node) => node.type === "text" && node.props.children === "Link this Watch",
	);
	expect(link.parent?.props.accessibilityHint).toContain("Fixture · S2E3");
	const text = JSON.stringify(renderer.toJSON());
	expect(text).toContain("Opnshelf");
	expect(text).toContain("Fixture · S2E3");
	press("Link this Watch");
	expect(mocks.mutate).not.toHaveBeenCalled();
	press("Confirm choice");
	expect(mocks.mutate).toHaveBeenCalledWith({
		action: "link",
		candidateKey: "existing",
	});
});

it("asks for Popfeed write access before sending changes, with Popfeed's record types", () => {
	act(() => {
		renderer = create(
			<IntegrationSyncManager integration={POPFEED_INTEGRATION} embedded />,
		);
	});
	const radios = () =>
		renderer.root.findAll(
			(node) =>
				node.type === Pressable && node.props.accessibilityRole === "radio",
		);
	expect(
		radios()
			.map((node) => node.props.accessibilityLabel)
			.filter((label: string) => /→|Both/.test(label)),
	).toEqual(["Popfeed → Opnshelf", "Opnshelf → Popfeed", "Both directions"]);
	// The fixture status has no write access and syncs both ways.
	const texts = () =>
		renderer.root
			.findAll((node) => node.type === "text")
			.map((node) => node.props.children);
	expect(texts()).toContain("Allow Popfeed access");
	// The grant explains itself first; declining it starts nothing.
	press("Allow Popfeed access");
	expect(requestPermission).toHaveBeenCalledWith("popfeed");
	const enable = renderer.root.find(
		(node) =>
			node.type === Pressable &&
			node.props.accessibilityRole === "button" &&
			node.findAll((child) => child.props.children === "Enable sync").length >
				0,
	);
	expect(enable.props.disabled).toBe(true);
	act(() =>
		radios()
			.find((node) => node.props.accessibilityLabel === "Popfeed → Opnshelf")
			?.props.onPress(),
	);
	expect(texts()).not.toContain("Allow Popfeed access");
	press("Choose records");
	expect(
		renderer.root
			.findAll((node) => node.type === "switch")
			.map((node) => node.props.accessibilityLabel)
			.filter((label: string) => !label.startsWith("I understand")),
	).toEqual([
		"Watch history",
		"Ratings",
		"Watchlist",
		"Custom Lists",
		"Reviews",
	]);
});

it("connects Popfeed in place instead of opening a browser", () => {
	mocks.disconnected = true;
	act(() => {
		renderer = create(
			<IntegrationSyncManager integration={POPFEED_INTEGRATION} embedded />,
		);
	});
	press("Set up Popfeed Sync");
	expect(mocks.mutate).toHaveBeenCalledWith({ platform: "mobile" });
});
