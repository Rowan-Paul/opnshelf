import { movieCollectionName, movieCollectionRail } from "@opnshelf/api";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	MovieCollectionEyebrow,
	MovieCollectionRail,
} from "./MovieCollectionRail";

const state = vi.hoisted(() => ({
	isAuthenticated: false,
	watchCounts: undefined as
		| { movieId: string; watchCount: number }[]
		| undefined,
}));
vi.mock("./ActionableMediaCard", () => ({
	default: (props: {
		id: string;
		title: string;
		year: string | number;
		interactive: boolean;
	}) => (
		<a href={`/movies/${props.id}`} data-interactive={props.interactive}>
			{props.title} {props.year}
		</a>
	),
}));
vi.mock("#/lib/auth-context", () => ({
	useAuth: () => ({
		user: state.isAuthenticated ? { did: "did:plc:viewer" } : undefined,
		isAuthenticated: state.isAuthenticated,
	}),
}));
vi.mock("@tanstack/react-query", async (importOriginal) => ({
	...(await importOriginal<typeof import("@tanstack/react-query")>()),
	useQuery: () => ({ data: state.watchCounts }),
}));

const collection = {
	id: 10,
	name: "Example Collection",
	movies: [
		{ id: 1, title: "First", release_date: "2020-01-01", poster_path: "/1" },
		{ id: 2, title: "Second", release_date: "2021-01-01" },
		{ id: 3, title: "Third", release_date: "2022-01-01" },
		{ id: 4, title: "Fourth", release_date: "2099-01-01" },
		{ id: 5, title: "Announced" },
	],
};

afterEach(() => {
	state.isAuthenticated = false;
	state.watchCounts = undefined;
	cleanup();
});

describe("movieCollectionRail", () => {
	it("drops TMDB's trailing “Collection” from the name", () => {
		expect(movieCollectionName("Mad Max Collection")).toBe("Mad Max");
		expect(movieCollectionName("Collection")).toBe("Collection");
	});

	it("places the movie and counts the viewer's Watches", () => {
		const rail = movieCollectionRail(collection, "2", [
			{ movieId: "1", watchCount: 2 },
		]);
		expect(rail).toMatchObject({
			name: "Example",
			position: 2,
			total: 5,
			watchedCount: 1,
		});
		expect(rail?.items.map((item) => item.isWatched)).toEqual([
			true,
			false,
			false,
			false,
			false,
		]);
		expect(rail?.items.filter((item) => item.isCurrent)).toMatchObject([
			{ id: "2", year: 2021 },
		]);
	});

	it("is absent for a movie outside the collection or a collection of one", () => {
		expect(movieCollectionRail(collection, "99")).toBeUndefined();
		expect(
			movieCollectionRail(
				{ ...collection, movies: [collection.movies[0]] },
				"1",
			),
		).toBeUndefined();
		expect(movieCollectionRail(undefined, "1")).toBeUndefined();
	});
});

describe("MovieCollectionRail", () => {
	it("lists every movie in order and marks the current one, without Watches when signed out", () => {
		render(<MovieCollectionRail collection={collection} movieId="2" />);

		expect(
			screen.getByRole("heading", { name: "Example movies" }),
		).toBeTruthy();
		const items = screen.getAllByRole("listitem");
		expect(items.map((item) => item.textContent)).toEqual([
			"First 2020Movie 1",
			"Second 2021Movie 2",
			"Third 2022Movie 3",
			"Fourth 2099Movie 4",
			"Announced TBAMovie 5",
		]);
		expect(items.map((item) => item.getAttribute("aria-current"))).toEqual([
			null,
			"true",
			null,
			null,
			null,
		]);
		expect(
			screen.getAllByRole("link")[0].getAttribute("data-interactive"),
		).toBe("false");
		expect(screen.queryByText(/watched/)).toBeNull();
	});

	it("shows the viewer's progress and offers the shelf actions when signed in", () => {
		state.isAuthenticated = true;
		state.watchCounts = [{ movieId: "1", watchCount: 1 }];
		render(<MovieCollectionRail collection={collection} movieId="3" />);

		expect(screen.getByText("1 of 5 watched")).toBeTruthy();
		expect(
			screen.getAllByRole("link")[0].getAttribute("data-interactive"),
		).toBe("true");
	});
});

describe("MovieCollectionEyebrow", () => {
	it("says where the movie sits and scrolls to the rail", () => {
		render(
			<>
				<MovieCollectionEyebrow collection={collection} movieId="2" />
				<MovieCollectionRail collection={collection} movieId="2" />
			</>,
		);
		const rail = document.getElementById("movie-collection") as HTMLElement;
		rail.scrollIntoView = vi.fn();
		window.matchMedia = vi.fn().mockReturnValue({ matches: false });

		screen.getByRole("button", { name: "Example · Movie 2 of 5" }).click();

		expect(rail.scrollIntoView).toHaveBeenCalledWith({
			behavior: "smooth",
			block: "center",
		});
	});

	it("renders nothing for a movie that stands alone", () => {
		const { container } = render(
			<MovieCollectionEyebrow collection={undefined} movieId="2" />,
		);
		expect(container.innerHTML).toBe("");
	});
});
