import { createElement, type ReactNode } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import MoviePage from "@/app/movies/[id]/[name]/index";
import ShowPage from "@/app/shows/[id]/[name]/index";
import EpisodePage from "@/app/shows/[id]/[name]/seasons/[seasonNumber]/episodes/[episodeNumber]/index";
import SeasonPage from "@/app/shows/[id]/[name]/seasons/[seasonNumber]/index";

const state = vi.hoisted(() => ({
	averageRating: undefined as number | undefined,
	query: vi.fn(),
}));
vi.mock("@tanstack/react-query", async (original) => ({
	...(await original<typeof import("@tanstack/react-query")>()),
	useQuery: (options: { queryKey: Array<{ _id: string; query?: object }> }) => {
		const key = options.queryKey[0];
		if (key._id === "ratingsControllerGetMediaRating") {
			state.query(key.query);
			return {
				data: {
					averageRating: state.averageRating,
					ratingCount: state.averageRating ? 1 : 0,
				},
			};
		}
		return {
			data: {
				name: "Fixture",
				title: "Fixture",
				vote_average: 5,
				seasons: [],
				episodes: [],
			},
		};
	},
}));
vi.mock("@/lib/env", () => ({ env: { siteUrl: "https://example.com" } }));
vi.mock("expo-router", () => ({
	Stack: { Screen: () => null },
	Link: ({ children }: { children: ReactNode }) => children,
	router: {},
	useLocalSearchParams: () => ({
		id: "226698",
		name: "fixture",
		seasonNumber: "3",
		episodeNumber: "2",
	}),
}));
vi.mock("react-native", () => {
	const component = (name: string) => (props: Record<string, unknown>) =>
		createElement(name, props, props.children as ReactNode);
	return {
		View: component("view"),
		Pressable: component("pressable"),
		ScrollView: component("scroll-view"),
		RefreshControl: component("refresh-control"),
		FlatList: ({
			ListHeaderComponent,
			ListFooterComponent,
		}: {
			ListHeaderComponent: ReactNode;
			ListFooterComponent: ReactNode;
		}) => (
			<>
				{ListHeaderComponent}
				{ListFooterComponent}
			</>
		),
		findNodeHandle: vi.fn(),
	};
});
vi.mock("@/components/ui/text", () => ({
	Text: ({ children }: { children: ReactNode }) =>
		createElement("text", null, children),
}));
vi.mock("expo-linear-gradient", () => ({ LinearGradient: () => null }));
vi.mock("lucide-react-native", () => ({
	Star: () => null,
	ChevronLeft: () => null,
	ChevronRight: () => null,
}));
vi.mock("@/components/media/PosterImage", () => ({ PosterImage: () => null }));
vi.mock("@/components/media/poster-progress", () => ({
	PosterProgress: () => null,
}));
vi.mock("@/lib/theme-context", () => ({
	useTheme: () => ({ scheme: "light" }),
}));
vi.mock("@/lib/use-tw-style", () => ({ useTwStyle: () => ({}) }));
vi.mock("@/lib/use-refresh", () => ({ useRefreshActiveQueries: () => ({}) }));
vi.mock("@/lib/use-show-progress", () => ({
	useShowProgress: () => ({}),
	findShowProgress: () => undefined,
}));
vi.mock("@/lib/use-up-next", () => ({ useUpNext: () => ({ items: [] }) }));
vi.mock("@/components/detail/AddToLibraryButton", () => ({
	AddToLibraryButton: () => null,
}));
vi.mock("@/components/detail/AddToListButton", () => ({
	AddToListButton: () => null,
}));
vi.mock("@/components/detail/CommunityReviews", () => ({
	CommunityReviews: () => null,
}));
vi.mock("@/components/detail/CreditsSection", () => ({
	CreditsSummary: () => null,
	CastSection: () => null,
	CrewSection: () => null,
	CreditsSection: () => null,
}));
vi.mock("@/components/detail/FriendWatchers", () => ({
	FriendWatchers: () => null,
}));
vi.mock("@/components/detail/MediaTrackingActions", () => ({
	MediaTrackingActions: () => null,
}));
vi.mock("@/components/detail/MetadataPills", () => ({
	MetadataPills: () => null,
}));
vi.mock("@/components/detail/NoteButton", () => ({ NoteButton: () => null }));
vi.mock("@/components/detail/OverviewSection", () => ({
	OverviewSection: () => null,
}));
vi.mock("@/components/detail/RateReviewButton", () => ({
	RateReviewButton: () => null,
}));
vi.mock("@/components/detail/ShareButton", () => ({ ShareButton: () => null }));
vi.mock("@/components/detail/SimilarMedia", () => ({
	SimilarMedia: () => null,
}));
vi.mock("@/components/detail/WatchlistFavoritesButtons", () => ({
	WatchlistFavoritesButtons: () => null,
}));
vi.mock("@/components/detail/WatchProviders", () => ({
	WatchProviders: () => null,
}));
vi.mock("@/components/detail/SeasonCard", () => ({ SeasonCard: () => null }));
vi.mock("@/components/detail/EpisodeCard", () => ({ EpisodeCard: () => null }));
vi.mock("@/components/ui/skeletons", () => ({ DetailSkeleton: () => null }));
vi.mock("@/components/ui/states", () => ({
	ErrorState: () => null,
	EmptyState: () => null,
}));
let renderer: ReactTestRenderer;
afterEach(() => {
	if (renderer) act(() => renderer.unmount());
	state.query.mockClear();
});
for (const [kind, Page, coordinates] of [
	["movie", MoviePage, {}],
	["show", ShowPage, {}],
	["season", SeasonPage, { seasonNumber: 3 }],
	["episode", EpisodePage, { seasonNumber: 3, episodeNumber: 2 }],
] as const) {
	describe(`${kind} detail rating`, () => {
		it.each([
			{ average: 8, expected: "8.0/10" },
			{ average: undefined, expected: "5.0/10" },
		])("uses the scoped average $average or TMDB throughout", ({
			average,
			expected,
		}) => {
			state.averageRating = average;
			act(() => {
				renderer = create(<Page />);
			});
			const ratings = renderer.root
				.findAllByType("text" as never)
				.map((node) => node.children.join(""))
				.filter((text) => text.endsWith("/10"));
			expect(ratings).toEqual(
				kind === "movie" || kind === "show" ? [expected] : [expected, expected],
			);
			expect(state.query).toHaveBeenCalledWith({
				mediaType: kind,
				mediaId: "226698",
				...coordinates,
			});
		});
	});
}
