import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthFlowError } from "@/lib/auth-error";
import { ProviderUnavailableError } from "@/lib/provider-error";
import { ProviderButtons } from "./ProviderButtons";

const mocks = vi.hoisted(() => ({
	toastError: vi.fn(),
	replace: vi.fn(),
	push: vi.fn(),
	runAuthorizationUrl: vi.fn(),
	beginHandoff: vi.fn(),
	signInWithProvider: vi.fn(),
	supportsNativeApple: vi.fn(),
	isGoogleConfigured: vi.fn(),
	colorScheme: vi.fn(),
}));

vi.mock("expo-apple-authentication", async () => {
	const { createElement } = await import("react");
	return {
		AppleAuthenticationButton: (props: Record<string, unknown>) =>
			createElement("apple-button", props),
		AppleAuthenticationButtonType: { CONTINUE: "CONTINUE" },
		AppleAuthenticationButtonStyle: {
			WHITE: "WHITE",
			WHITE_OUTLINE: "WHITE_OUTLINE",
			BLACK: "BLACK",
		},
	};
});

vi.mock("expo-router", () => ({
	router: { replace: mocks.replace, push: mocks.push },
}));

vi.mock("react-native", async () => {
	const { createElement } = await import("react");
	return {
		ActivityIndicator: (props: Record<string, unknown>) =>
			createElement("activity-indicator", props),
		Pressable: (props: Record<string, unknown>) =>
			createElement("pressable", props, props.children as never),
		Text: (props: Record<string, unknown>) =>
			createElement("text", props, props.children as never),
		View: (props: Record<string, unknown>) =>
			createElement("view", props, props.children as never),
		useColorScheme: () => mocks.colorScheme(),
	};
});

// The marks are real SVG components; the renderer only needs them to be
// elements, and react-native-svg does not parse outside a native build.
vi.mock("react-native-svg", async () => {
	const { createElement } = await import("react");
	return {
		default: (props: Record<string, unknown>) =>
			createElement("svg", props, props.children as never),
		Svg: (props: Record<string, unknown>) =>
			createElement("svg", props, props.children as never),
		Path: (props: Record<string, unknown>) => createElement("path", props),
	};
});

vi.mock("@/components/ui/toast", () => ({
	useToast: () => ({ error: mocks.toastError }),
}));

vi.mock("@/lib/auth-context", () => ({
	useAuth: () => ({ runAuthorizationUrl: mocks.runAuthorizationUrl }),
}));

vi.mock("@/lib/auth-handoff", () => ({ beginHandoff: mocks.beginHandoff }));

vi.mock("@/lib/env", () => ({
	env: { apiUrl: "https://api.test" },
}));

// Mocked whole: the real module loads the native Google and Apple SDKs, which
// do not resolve outside a device build. ProviderUnavailableError is imported
// from provider-error precisely so it survives this.
vi.mock("@/lib/provider-signin", () => ({
	signInWithProvider: mocks.signInWithProvider,
	supportsNativeApple: mocks.supportsNativeApple,
	isGoogleConfigured: mocks.isGoogleConfigured,
}));

/**
 * The host element react-test-renderer rendered. The mocked primitives render
 * names TypeScript does not know as intrinsic elements, so comparing
 * `node.type` to them directly is a type error.
 */
function hostType(node: { type: unknown }): string {
	return typeof node.type === "string" ? node.type : "";
}

function render() {
	let renderer!: ReactTestRenderer;
	act(() => {
		renderer = create(<ProviderButtons />);
	});
	return renderer;
}

/** Tap a provider button by the label the user actually sees. */
async function press(renderer: ReactTestRenderer, label: string) {
	const text = renderer.root.find(
		(node) =>
			hostType(node) === "text" &&
			[node.props.children].flat().join("").includes(label),
	);
	let pressable = text.parent;
	while (pressable && hostType(pressable) !== "pressable") {
		pressable = pressable.parent;
	}
	if (!pressable) throw new Error(`No button labelled ${label}`);
	const { onPress } = pressable.props as { onPress: () => unknown };
	await act(async () => {
		await onPress();
	});
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.colorScheme.mockReturnValue("light");
	mocks.supportsNativeApple.mockReturnValue(false);
	mocks.isGoogleConfigured.mockReturnValue(true);
	mocks.beginHandoff.mockResolvedValue("challenge");
	mocks.runAuthorizationUrl.mockResolvedValue(true);
	mocks.signInWithProvider.mockResolvedValue({ kind: "cancelled" });
});

describe("ProviderButtons", () => {
	it("runs Apple in the browser where there is no native credential", async () => {
		const renderer = render();
		await press(renderer, "Continue with Apple");

		// platform and the challenge have to ride along, or the flow finishes in
		// the browser and never returns to the app (ADR 0026).
		expect(mocks.runAuthorizationUrl).toHaveBeenCalledWith(
			"https://api.test/auth/apple/start?platform=mobile&code_challenge=challenge",
		);
		expect(mocks.signInWithProvider).not.toHaveBeenCalled();
		expect(mocks.replace).toHaveBeenCalledWith("/");
	});

	it("reports why the browser leg failed instead of a generic retry", async () => {
		// The bug this replaces: every failure read "Couldn't sign in with Apple.
		// Try again.", including ones retrying cannot fix.
		mocks.runAuthorizationUrl.mockRejectedValue(
			new AuthFlowError("apple_email_unverified"),
		);
		const renderer = render();
		await press(renderer, "Continue with Apple");

		expect(mocks.toastError).toHaveBeenCalledWith(
			expect.stringContaining("Apple hasn't verified that email address"),
		);
	});

	it("passes a provider's own unavailable message straight through", async () => {
		mocks.supportsNativeApple.mockReturnValue(true);
		mocks.signInWithProvider.mockRejectedValue(
			new ProviderUnavailableError("Sign in with Apple is not available"),
		);
		const renderer = render();
		const button = renderer.root.find(
			(node) => hostType(node) === "apple-button",
		);
		const { onPress } = button.props as { onPress: () => unknown };
		await act(async () => {
			onPress();
		});

		expect(mocks.toastError).toHaveBeenCalledWith(
			"Sign in with Apple is not available",
		);
	});

	it("falls back to a generic message for an unrecognised failure", async () => {
		mocks.signInWithProvider.mockRejectedValue(new Error("socket hang up"));
		const renderer = render();
		await press(renderer, "Continue with Google");

		expect(mocks.toastError).toHaveBeenCalledWith(
			"Couldn't sign in with Google. Try again.",
		);
	});

	it("sends a new user to the handle picker with their pending registration", async () => {
		mocks.signInWithProvider.mockResolvedValue({
			kind: "register",
			pendingToken: "pending",
			email: "user@example.com",
		});
		const renderer = render();
		await press(renderer, "Continue with Google");

		expect(mocks.push).toHaveBeenCalledWith({
			pathname: "/signup-handle",
			params: {
				provider: "google",
				pendingToken: "pending",
				email: "user@example.com",
			},
		});
	});

	it("says nothing when the user backs out", async () => {
		const renderer = render();
		await press(renderer, "Continue with Google");

		expect(mocks.toastError).not.toHaveBeenCalled();
		expect(mocks.replace).not.toHaveBeenCalled();
	});

	describe("the button pair", () => {
		/** The style props both buttons are rendered with. */
		function boxes(renderer: ReactTestRenderer) {
			return renderer.root
				.findAll((node) => hostType(node) === "pressable")
				.map((node) => node.props.style as Record<string, unknown>);
		}

		it("gives both providers the same box", () => {
			// Apple asks that their button be no less prominent than the
			// alternatives, and an uneven pair steers the choice regardless.
			const renderer = render();
			const [appleBox, googleBox] = boxes(renderer);

			expect(appleBox.height).toBe(googleBox.height);
			expect(appleBox.borderRadius).toBe(googleBox.borderRadius);
			// --radius-lg, the radius every other button in the app uses.
			expect(appleBox.borderRadius).toBe(16);
		});

		it("paints Google in its published colours, per theme", () => {
			// Branding requirements, not theme tokens:
			// https://developers.google.com/identity/branding-guidelines
			const light = boxes(render())[1];
			expect(light.backgroundColor).toBe("#FFFFFF");
			expect(light.borderColor).toBe("#747775");

			mocks.colorScheme.mockReturnValue("dark");
			const dark = boxes(render())[1];
			expect(dark.backgroundColor).toBe("#131314");
			expect(dark.borderColor).toBe("#8E918F");
		});

		it("matches the native Apple button to the theme the same way", () => {
			mocks.supportsNativeApple.mockReturnValue(true);
			const outlined = render().root.find(
				(node) => hostType(node) === "apple-button",
			);
			expect(outlined.props.buttonStyle).toBe("WHITE_OUTLINE");
			expect(outlined.props.cornerRadius).toBe(16);
			expect(outlined.props.style.height).toBe(48);

			mocks.colorScheme.mockReturnValue("dark");
			const filled = render().root.find(
				(node) => hostType(node) === "apple-button",
			);
			expect(filled.props.buttonStyle).toBe("BLACK");
		});

		it("shows each provider's mark", () => {
			// Google's rules require the official multi-colour G; Apple's require
			// their logo wherever their name appears.
			const renderer = render();
			expect(
				renderer.root.findAll((node) => hostType(node) === "svg"),
			).toHaveLength(2);
		});
	});

	it("hides Google when it is not configured", () => {
		mocks.isGoogleConfigured.mockReturnValue(false);
		const renderer = render();

		const labels = JSON.stringify(renderer.toJSON());
		expect(labels).toContain("Continue with Apple");
		// Offering a button that dead-ends is worse than not offering one.
		expect(labels).not.toContain("Continue with Google");
	});
});
