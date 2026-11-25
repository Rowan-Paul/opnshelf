import { createElement, type PropsWithChildren } from "react";
import { Text } from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { expect, it, vi } from "vitest";
import { PersonHero } from "./PersonHero";

vi.mock("react-native", () => ({
	View: ({ children }: PropsWithChildren) =>
		createElement("view", null, children),
	Text: ({ children }: PropsWithChildren) =>
		createElement("text", null, children),
}));
vi.mock("lucide-react-native", () => ({
	Calendar: () => null,
	Clapperboard: () => null,
	MapPin: () => null,
	User: () => null,
}));
vi.mock("@/components/media/PosterImage", () => ({ PosterImage: () => null }));

it("shows the catalogue birth and death dates and age west of UTC", () => {
	vi.stubEnv("TZ", "America/Los_Angeles");
	let view: ReactTestRenderer | undefined;
	try {
		expect(new Date("1950-01-01").getDate()).toBe(31);
		act(() => {
			view = create(
				<PersonHero
					person={{
						id: 1,
						name: "Example Person",
						birthday: "1950-01-01",
						deathday: "2020-12-31",
						filmography: [],
					}}
				/>,
			);
		});
		const dates = new Intl.DateTimeFormat(undefined, {
			day: "numeric",
			month: "short",
			year: "numeric",
		});
		const birthday = dates.format(new Date(1950, 0, 1, 12));
		const deathday = dates.format(new Date(2020, 11, 31, 12));
		const labels = view?.root
			.findAllByType(Text)
			.map((node) => [node.props.children].flat().join(""));
		expect(labels).toEqual(
			expect.arrayContaining([
				`Born ${birthday}`,
				`Died ${deathday} (aged 70)`,
			]),
		);
	} finally {
		act(() => view?.unmount());
		vi.unstubAllEnvs();
	}
});
