import type { PropsWithChildren } from "react";
import { createElement } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UpNextCard } from "@/components/up-next/UpNextCard";
import { UpNextEpisodeCard } from "@/components/up-next/UpNextEpisodeCard";
import { UpNextServiceFilter } from "@/components/up-next/UpNextServiceFilter";
import { UpNextTab } from "./UpNextTab";

const mocks = vi.hoisted(() => ({
	push: vi.fn(),
	setParams: vi.fn(),
	services: undefined as string | undefined,
	savedIds: [] as number[],
}));
function host(name: string) {
	return ({ children, ...props }: PropsWithChildren) =>
		createElement(name, props, children);
}
vi.mock("react-native", () => ({ View: host("View") }));
vi.mock("lucide-react-native", () => ({ Tv: host("Tv") }));
vi.mock("expo-router", () => ({
	useRouter: () => mocks,
	useLocalSearchParams: () => ({ services: mocks.services }),
}));
vi.mock("@tanstack/react-query", () => ({
	queryOptions: (options: unknown) => options,
	useQuery: () => ({
		data: { watchCountry: "NL", streamingServiceIds: mocks.savedIds },
	}),
}));
vi.mock("@/lib/use-public-profile", () => ({
	useInfiniteProfileUpNext: () => ({
		data: {
			pages: [
				{
					items: [
						{ showId: "1", nextEpisode: { seasonNumber: 1, episodeNumber: 1 } },
					],
				},
			],
		},
	}),
}));
vi.mock("@/lib/use-end-reached", () => ({ useEndReached: vi.fn() }));
vi.mock("@/components/ui/load-more", () => ({
	canLoadMore: () => false,
	LoadMoreFooter: host("Footer"),
}));
vi.mock("@/components/ui/states", () => ({
	EmptyState: host("Empty"),
	ErrorState: host("Error"),
}));
vi.mock("@/components/ui/text", () => ({ Text: host("Text") }));
vi.mock("@/components/up-next/UpNextCard", () => ({
	UpNextCard: host("Card"),
}));
vi.mock("@/components/up-next/UpNextEpisodeCard", () => ({
	UpNextEpisodeCard: host("EpisodeCard"),
}));
vi.mock("@/components/up-next/UpNextSkeleton", () => ({
	UpNextSkeleton: host("Skeleton"),
}));
vi.mock("@/components/up-next/UpNextServiceFilter", () => ({
	UpNextServiceFilter: host("Filter"),
}));
function renderTab(filterHandle?: string) {
	let view: ReactTestRenderer | undefined;
	act(() => {
		view = create(
			<UpNextTab userDid="did:plc:demo" isOwner filterHandle={filterHandle} />,
		);
	});
	if (!view) throw new Error("Tab did not render");
	return view;
}
beforeEach(() => {
	vi.clearAllMocks();
	mocks.services = undefined;
	mocks.savedIds = [];
});
describe("Up Next filter navigation", () => {
	it("keeps compact cards in the profile hub and episode tiles on the full screen", () => {
		const hub = renderTab("demo.test");
		expect(hub.root.findAllByType(UpNextCard)).toHaveLength(1);
		expect(hub.root.findAllByType(UpNextEpisodeCard)).toHaveLength(0);
		act(() => hub.unmount());
		const full = renderTab();
		expect(full.root.findAllByType(UpNextEpisodeCard)).toHaveLength(1);
		expect(full.root.findAllByType(UpNextCard)).toHaveLength(0);
		act(() => full.unmount());
	});
	it("applies hub filters on the canonical route rather than the hub URL", () => {
		const view = renderTab("demo.test");
		act(() => view.root.findByType(UpNextServiceFilter).props.onChange("350"));
		expect(mocks.push).toHaveBeenCalledWith({
			pathname: "/profile/[handle]/up-next",
			params: { handle: "demo.test", services: "350" },
		});
		expect(mocks.setParams).not.toHaveBeenCalled();
		act(() => view.unmount());
	});
	it("clears filters in place on the dedicated route", () => {
		const view = renderTab();
		act(() =>
			view.root.findByType(UpNextServiceFilter).props.onChange(undefined),
		);
		expect(mocks.setParams).toHaveBeenCalledWith({ services: undefined });
		expect(mocks.push).not.toHaveBeenCalled();
		act(() => view.unmount());
	});
	it("opens the picker for a legacy My Services link without subscriptions", () => {
		mocks.services = "mine";
		const view = renderTab();
		expect(view.root.findByType(UpNextServiceFilter).props.needsSelection).toBe(
			true,
		);
		act(() => view.unmount());
	});
});
