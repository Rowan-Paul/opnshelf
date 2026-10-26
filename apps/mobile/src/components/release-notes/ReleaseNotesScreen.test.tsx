import type { ReactElement } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { expect, it, vi } from "vitest";
import { ReleaseNotesScreen } from "./ReleaseNotesScreen";

const notes = [
	{
		slug: "celebrate-your-watching",
		title: "Celebrate your watching",
		publishedAt: "2026-10-26T00:00:00.000Z",
		summary: "A summary",
		markdown: "Release note body",
		platforms: { web: { status: "available" } },
	},
];

vi.mock("@opnshelf/api", () => ({
	RELEASE_PLATFORM_NAMES: { web: "Web" },
	RELEASE_PLATFORMS: ["web"],
	releaseAvailabilityLabel: () => "Available",
	releaseNoteDate: () => "26 October 2026",
}));
vi.mock("expo-router", () => ({
	Link: "Link",
	Stack: { Screen: "StackScreen" },
	useFocusEffect: () => {},
}));
vi.mock("lucide-react-native", () => ({
	ArrowUpRight: "ArrowUpRight",
}));
vi.mock("react-native", () => ({
	Pressable: "Pressable",
	ScrollView: "ScrollView",
	View: "View",
}));
vi.mock("react-native-safe-area-context", () => ({
	useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0 }),
}));
vi.mock("@/components/ui/Markdown", () => ({ Markdown: "Markdown" }));
vi.mock("@/components/ui/screen", () => ({ Screen: "Screen" }));
vi.mock("@/components/ui/states", () => ({
	ErrorState: "ErrorState",
	StaleDataNotice: "StaleDataNotice",
}));
vi.mock("@/components/ui/text", () => ({ Text: "Text" }));
vi.mock("@/lib/use-release-notes", () => ({
	useReleaseNotes: () => ({
		data: notes,
		isPending: false,
		isError: false,
		markError: false,
	}),
}));
vi.mock("@/theme/colors", () => ({
	useThemeColors: () => ({ accent: "black", mutedForeground: "black" }),
}));

function render(element: ReactElement): ReactTestRenderer {
	let renderer: ReactTestRenderer | undefined;
	act(() => {
		renderer = create(element);
	});
	if (!renderer) throw new Error("Renderer was not created");
	return renderer;
}

it("leaves going back to the stack header on a release note detail", () => {
	const renderer = render(
		<ReleaseNotesScreen slug="celebrate-your-watching" />,
	);

	expect(
		renderer.root
			.findAllByType("Link" as never)
			.filter((node) => node.props.href === "/whats-new"),
	).toHaveLength(0);
});

it("links a missing release note to the history", () => {
	const renderer = render(<ReleaseNotesScreen slug="missing-note" />);

	expect(
		renderer.root
			.findAllByType("Link" as never)
			.filter((node) => node.props.href === "/whats-new"),
	).toHaveLength(1);
});

it("keeps history entries linked to their release note details", () => {
	const renderer = render(<ReleaseNotesScreen />);

	expect(
		renderer.root.findAllByType("Link" as never).map((node) => node.props.href),
	).toEqual([
		{
			pathname: "/whats-new/[slug]",
			params: { slug: "celebrate-your-watching" },
		},
	]);
});
