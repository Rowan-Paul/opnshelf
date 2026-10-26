import { Animated } from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, expect, it, vi } from "vitest";
import { CompletionConfetti, celebrateCompletion } from "./completion-confetti";

const mocks = vi.hoisted(() => ({
	timing: vi.fn(() => ({ start: vi.fn(), stop: vi.fn() })),
	reduced: vi.fn(),
	enabled: vi.fn(),
}));
vi.mock("react-native", () => ({
	AccessibilityInfo: { isReduceMotionEnabled: mocks.reduced },
	Animated: {
		View: "Particle",
		Value: class {
			interpolate() {
				return 0;
			}
		},
		timing: mocks.timing,
	},
	Easing: { linear: 0 },
	StyleSheet: { absoluteFill: {} },
	useWindowDimensions: () => ({ width: 390, height: 800 }),
	View: "Overlay",
}));
vi.mock("@/lib/confetti-preference", () => ({
	isConfettiEnabled: mocks.enabled,
}));
let renderer: ReactTestRenderer;
afterEach(async () => {
	if (renderer) await act(async () => renderer.unmount());
	vi.useRealTimers();
	vi.clearAllMocks();
});
it("coalesces rapid requests into one native-driver burst and cleans up", async () => {
	vi.useFakeTimers();
	mocks.reduced.mockResolvedValue(false);
	mocks.enabled.mockResolvedValue(true);
	await act(async () => {
		renderer = create(<CompletionConfetti />);
	});
	await act(async () => {
		for (let i = 0; i < 100; i++) celebrateCompletion();
	});
	expect(mocks.reduced).toHaveBeenCalledTimes(1);
	expect(mocks.timing).toHaveBeenCalledTimes(1);
	expect(mocks.timing).toHaveBeenCalledWith(
		expect.anything(),
		expect.objectContaining({ useNativeDriver: true, duration: 3600 }),
	);
	expect(renderer.root.findAllByType(Animated.View)).toHaveLength(64);
	await act(async () => celebrateCompletion());
	expect(mocks.timing).toHaveBeenCalledTimes(1);
	await act(async () => {
		vi.advanceTimersByTime(3700);
	});
	expect(renderer.toJSON()).toBeNull();
	await act(async () => celebrateCompletion());
	expect(mocks.timing).toHaveBeenCalledTimes(2);
});
it.each([
	{ reduced: true, enabled: true },
	{ reduced: false, enabled: false },
])("does no animation work for $reduced/$enabled", async ({
	reduced,
	enabled,
}) => {
	mocks.reduced.mockResolvedValue(reduced);
	mocks.enabled.mockResolvedValue(enabled);
	await act(async () => {
		renderer = create(<CompletionConfetti />);
	});
	await act(async () => celebrateCompletion());
	expect(mocks.timing).not.toHaveBeenCalled();
	expect(renderer.toJSON()).toBeNull();
});
