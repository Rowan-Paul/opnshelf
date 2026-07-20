import { afterAll, beforeAll, vi } from "vitest";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

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
