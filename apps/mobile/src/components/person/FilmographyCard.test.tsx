import type { PersonFilmographyItemDto } from "@opnshelf/api";
import { createElement, type PropsWithChildren } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { expect, it, vi } from "vitest";
import { FilmographyCard } from "./FilmographyCard";

function host(name: string) {
	return ({ children, ...props }: PropsWithChildren) =>
		createElement(name, props, children);
}
vi.mock("@/components/media/MediaCard", () => ({
	MediaCard: host("MediaCard"),
}));

it.each([
	"movie",
	"tv",
])("enables shared shelf actions for %s credits and preserves their role", (media_type) => {
	const item: PersonFilmographyItemDto = {
		id: 1399,
		title: "Example",
		media_type,
		character: "A character",
		first_air_date: "2020-01-01",
	};
	let view: ReactTestRenderer | undefined;
	act(() => {
		view = create(<FilmographyCard item={item} />);
	});
	if (!view) throw new Error("Filmography card did not render");
	const card = view.root.findAllByType("MediaCard" as never);
	expect(card).toHaveLength(1);
	expect(card[0].props.actions).toBe(true);
	expect(card[0].props.item).toMatchObject({
		id: 1399,
		type: media_type === "movie" ? "movie" : "show",
		title: "Example",
		label: "2020 · A character",
	});
	act(() => view?.unmount());
});
