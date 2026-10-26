import { afterAll, beforeAll, vi } from "vitest";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

// Uniwind ships untranspiled React Native source that Node cannot parse. Its
// CSS variables only exist inside the Metro build, so tests read the light
// fallbacks in `@/theme/colors`. A test file can still `vi.mock("uniwind")`.
vi.mock("uniwind", () => ({
	useCSSVariable: (names: string | string[]) =>
		Array.isArray(names) ? names.map(() => undefined) : undefined,
	useResolveClassNames: () => ({}),
	useUniwind: () => ({ theme: "light", hasAdaptiveThemes: true }),
	withUniwind: <T>(component: T) => component,
	Uniwind: { setTheme: () => {} },
}));

const testRendererDeprecation =
	"react-test-renderer is deprecated. See https://react.dev/warnings/react-test-renderer";
const originalConsoleError = console.error;

beforeAll(() => {
	vi.spyOn(console, "error").mockImplementation((message, ...args) => {
		if (message === testRendererDeprecation) return;
		originalConsoleError(message, ...args);
	});
});

afterAll(() => {
	vi.restoreAllMocks();
});
