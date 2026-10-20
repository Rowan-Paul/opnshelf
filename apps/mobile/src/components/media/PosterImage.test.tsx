import { Image } from "expo-image";
import { ImageOff } from "lucide-react-native";
import { createElement, type PropsWithChildren } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { expect, it, vi } from "vitest";
import { PosterImage } from "./PosterImage";

function host(name: string) {
	return ({ children, ...props }: PropsWithChildren) =>
		createElement(name, props, children);
}
vi.mock("react-native", () => ({ View: host("View") }));
vi.mock("expo-image", () => ({ Image: host("Image") }));
vi.mock("lucide-react-native", () => ({ ImageOff: host("ImageOff") }));
vi.mock("@/lib/use-tw-style", () => ({
	useTwStyle: () => ({ width: 80, aspectRatio: 2 / 3 }),
}));

it("skips cached first appearances while keeping the network-load fade and missing-art placeholder", () => {
	let view: ReactTestRenderer | undefined;
	act(() => {
		view = create(
			<PosterImage url="https://image.tmdb.org/t/p/w342/poster.jpg" />,
		);
	});
	if (!view) throw new Error("Poster did not render");
	const renderer = view;
	expect(renderer.root.findByType(Image).props.transition).toEqual({
		duration: 200,
		skipOnCacheHit: "all",
	});
	expect(renderer.root.findByType(Image).props.style).toEqual({
		width: 80,
		aspectRatio: 2 / 3,
	});
	act(() => renderer.update(<PosterImage url={undefined} />));
	expect(renderer.root.findAllByType(Image)).toHaveLength(0);
	expect(renderer.root.findAllByType(ImageOff)).toHaveLength(1);
	act(() => renderer.unmount());
});
