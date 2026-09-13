import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";
import { PosterProgress } from "./poster-progress";

vi.mock("react-native", async () => {
	const React = await import("react");
	return {
		View: ({ children, ...props }: React.PropsWithChildren) =>
			React.createElement("View", props, children),
	};
});

describe("PosterProgress", () => {
	it.each([0, 47, 100])("renders authoritative %s%% progress", (percentage) => {
		let renderer: ReactTestRenderer | undefined;
		act(() => {
			renderer = create(
				<PosterProgress
					progress={{
						episodesWatched: percentage,
						episodesTotal: 100,
						percentage,
					}}
					label="Show progress"
				/>,
			);
		});

		if (!renderer) throw new Error("Progress did not render");
		const progressbar = renderer.root.findByProps({
			accessibilityRole: "progressbar",
		});
		expect(progressbar.props.accessibilityValue).toEqual({
			min: 0,
			max: 100,
			now: percentage,
		});
	});

	it("hides progress when there are no aired episodes", () => {
		let renderer: ReactTestRenderer | undefined;
		act(() => {
			renderer = create(
				<PosterProgress
					progress={{ episodesWatched: 0, episodesTotal: 0, percentage: 0 }}
					label="Season progress"
				/>,
			);
		});

		if (!renderer) throw new Error("Progress did not render");
		expect(renderer.toJSON()).toBeNull();
	});
});
