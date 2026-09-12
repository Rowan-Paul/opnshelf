import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SignupHandleScreen from "./signup-handle";

const mocks = vi.hoisted(() => ({
	appleRegister: vi.fn(),
	googleRegister: vi.fn(),
	replace: vi.fn(),
	toastError: vi.fn(),
	runAuthorizationUrl: vi.fn(),
	login: vi.fn(),
	params: {} as Record<string, string | undefined>,
}));

vi.mock("@opnshelf/api", () => ({
	authControllerAppleRegister: mocks.appleRegister,
	authControllerGoogleRegister: mocks.googleRegister,
}));

vi.mock("expo-router", async () => {
	const { createElement } = await import("react");
	return {
		router: { replace: mocks.replace },
		useLocalSearchParams: () => mocks.params,
		Redirect: (props: Record<string, unknown>) =>
			createElement("redirect", props),
	};
});

vi.mock("react-native", async () => {
	const { createElement } = await import("react");
	return {
		ActivityIndicator: (props: Record<string, unknown>) =>
			createElement("activity-indicator", props),
		Pressable: (props: Record<string, unknown>) =>
			createElement("pressable", props, props.children as never),
		ScrollView: (props: Record<string, unknown>) =>
			createElement("scroll-view", props, props.children as never),
		View: (props: Record<string, unknown>) =>
			createElement("view", props, props.children as never),
		// The Button primitive picks its spinner tint from the scheme.
		useColorScheme: () => "light",
	};
});

vi.mock("@/components/TurnstileWidget", async () => {
	const { createElement } = await import("react");
	return {
		TurnstileWidget: (props: Record<string, unknown>) =>
			createElement("turnstile", props),
	};
});

vi.mock("@/components/ui/screen", async () => {
	const { createElement } = await import("react");
	return {
		Screen: (props: Record<string, unknown>) =>
			createElement("screen", props, props.children as never),
	};
});

vi.mock("@/components/ui/text", async () => {
	const { createElement } = await import("react");
	return {
		Text: (props: Record<string, unknown>) =>
			createElement("text", props, props.children as never),
	};
});

vi.mock("@/components/ui/text-field", async () => {
	const { createElement } = await import("react");
	return {
		TextField: (props: Record<string, unknown>) =>
			createElement("text-field", props),
	};
});

vi.mock("@/components/ui/toast", () => ({
	useToast: () => ({ error: mocks.toastError }),
}));

vi.mock("@/lib/auth-context", () => ({
	useAuth: () => ({
		isAuthenticated: false,
		isLoading: false,
		login: mocks.login,
		runAuthorizationUrl: mocks.runAuthorizationUrl,
	}),
}));

// No site key: the captcha is skipped, which is the same escape hatch the
// backend uses when TURNSTILE_SECRET_KEY is unset.
vi.mock("@/lib/env", () => ({
	env: { turnstileSiteKey: undefined, pdsHandleDomain: "opnshelf.social" },
}));

/**
 * The host element react-test-renderer rendered. The mocked primitives render
 * names TypeScript does not know as intrinsic elements, so comparing
 * `node.type` to them directly is a type error.
 */
function hostType(node: { type: unknown }): string {
	return typeof node.type === "string" ? node.type : "";
}

let mounted: ReactTestRenderer | null = null;

function renderScreen() {
	const client = new QueryClient({
		defaultOptions: { mutations: { retry: false } },
	});
	act(() => {
		mounted = create(
			<QueryClientProvider client={client}>
				<SignupHandleScreen />
			</QueryClientProvider>,
		);
	});
	return mounted as unknown as ReactTestRenderer;
}

function visibleText(renderer: ReactTestRenderer): string {
	return renderer.root
		.findAll((node) => hostType(node) === "text")
		.map((node) => [node.props.children].flat().join(""))
		.join(" ");
}

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

/** Type a username into the only field on the screen. */
async function typeUsername(renderer: ReactTestRenderer, value: string) {
	const field = renderer.root.find((node) => hostType(node) === "text-field");
	const { onChangeText } = field.props as { onChangeText: (v: string) => void };
	await act(async () => {
		onChangeText(value);
	});
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.params = { provider: "apple", pendingToken: "pending-token" };
	mocks.appleRegister.mockResolvedValue({
		data: {
			did: "did:plc:abc",
			handle: "rowan.opnshelf.social",
			coreOAuthUrl: "https://pds.test/authorize",
		},
	});
	mocks.runAuthorizationUrl.mockResolvedValue(true);
	mocks.login.mockResolvedValue(true);
});

afterEach(() => {
	act(() => {
		mounted?.unmount();
	});
	mounted = null;
});

describe("the native handle picker", () => {
	it("registers and runs the authorization the account needs", async () => {
		const renderer = renderScreen();
		await typeUsername(renderer, "Rowan");
		await press(renderer, "Create account");

		expect(mocks.appleRegister).toHaveBeenCalledWith({
			body: expect.objectContaining({
				username: "rowan",
				pendingToken: "pending-token",
			}),
			throwOnError: true,
		});
		expect(mocks.runAuthorizationUrl).toHaveBeenCalledWith(
			"https://pds.test/authorize",
		);
		expect(mocks.replace).toHaveBeenCalledWith("/");
	});

	it("posts an Apple registration to Apple's endpoint only", async () => {
		mocks.params = { provider: "google", pendingToken: "pending-token" };
		mocks.googleRegister.mockResolvedValue({
			data: { handle: "rowan.opnshelf.social", coreOAuthUrl: "https://x.test" },
		});
		const renderer = renderScreen();
		await typeUsername(renderer, "rowan");
		await press(renderer, "Create account");

		expect(mocks.googleRegister).toHaveBeenCalled();
		expect(mocks.appleRegister).not.toHaveBeenCalled();
	});

	describe("when the authorization is dismissed after the account exists", () => {
		it("offers to finish signing in, not to create the account again", async () => {
			// Creating it again cannot work: the handle is taken, the pending
			// registration is spent, and Turnstile honours a token once.
			mocks.runAuthorizationUrl.mockResolvedValue(false);
			const renderer = renderScreen();
			await typeUsername(renderer, "rowan");
			await press(renderer, "Create account");

			const shown = visibleText(renderer);
			expect(shown).toContain("rowan.opnshelf.social");
			expect(shown).toContain("Continue signing in");
			expect(shown).not.toContain("Create account");
		});

		it("signs the existing account in rather than replaying the spent request", async () => {
			mocks.runAuthorizationUrl.mockResolvedValue(false);
			const renderer = renderScreen();
			await typeUsername(renderer, "rowan");
			await press(renderer, "Create account");

			await press(renderer, "Continue signing in");

			// A fresh login: the registration's request_uri is single-use and may
			// already be spent by the dismissed attempt.
			expect(mocks.login).toHaveBeenCalledWith("rowan.opnshelf.social");
			expect(mocks.appleRegister).toHaveBeenCalledTimes(1);
			expect(mocks.replace).toHaveBeenCalledWith("/");
		});

		it("says so when the retry is dismissed too", async () => {
			mocks.runAuthorizationUrl.mockResolvedValue(false);
			mocks.login.mockResolvedValue(false);
			const renderer = renderScreen();
			await typeUsername(renderer, "rowan");
			await press(renderer, "Create account");
			mocks.toastError.mockClear();

			await press(renderer, "Continue signing in");

			expect(mocks.toastError).toHaveBeenCalledWith(
				"Sign-in wasn't completed. Try again.",
			);
		});
	});

	it("reports a registration failure and lets the user try again", async () => {
		mocks.appleRegister.mockRejectedValue({
			message: "That username is already taken",
		});
		const renderer = renderScreen();
		await typeUsername(renderer, "rowan");
		await press(renderer, "Create account");

		expect(mocks.toastError).toHaveBeenCalledWith(
			"That username is already taken",
		);
		// Still the form: nothing was created, so retrying is the right offer.
		expect(visibleText(renderer)).toContain("Create account");
	});

	it("sends a stale visit back to signup rather than showing a dead form", () => {
		mocks.params = { provider: "apple" };
		const renderer = renderScreen();

		const redirect = renderer.root.find(
			(node) => hostType(node) === "redirect",
		);
		expect(redirect.props.href).toBe("/signup");
	});
});
