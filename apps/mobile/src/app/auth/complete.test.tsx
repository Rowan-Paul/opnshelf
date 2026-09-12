import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NoPendingHandoffError } from "@/lib/handoff-error";
import AuthCompleteScreen from "./complete";

const mocks = vi.hoisted(() => ({
	replace: vi.fn(),
	completeHandoff: vi.fn(),
	completeSession: vi.fn(),
	params: {} as Record<string, string | undefined>,
}));

vi.mock("expo-router", () => ({
	router: { replace: mocks.replace },
	useLocalSearchParams: () => mocks.params,
}));

vi.mock("react-native", async () => {
	const { createElement } = await import("react");
	return {
		ActivityIndicator: (props: Record<string, unknown>) =>
			createElement("activity-indicator", props),
		View: (props: Record<string, unknown>) =>
			createElement("view", props, props.children as never),
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

vi.mock("@/lib/auth-context", () => ({
	useAuth: () => ({
		completeHandoff: mocks.completeHandoff,
		completeSession: mocks.completeSession,
	}),
}));

/**
 * The host element react-test-renderer rendered. The mocked primitives render
 * names TypeScript does not know as intrinsic elements, so comparing
 * `node.type` to them directly is a type error.
 */
function hostType(node: { type: unknown }): string {
	return typeof node.type === "string" ? node.type : "";
}

function renderScreen() {
	let renderer!: ReactTestRenderer;
	act(() => {
		renderer = create(<AuthCompleteScreen />);
	});
	return renderer;
}

/** Everything the screen is currently showing the user. */
function visibleText(renderer: ReactTestRenderer): string {
	return renderer.root
		.findAll((node) => hostType(node) === "text")
		.map((node) => [node.props.children].flat().join(""))
		.join(" ");
}

/** Let the pending promises and the 1.5s redirect timer run. */
async function settle() {
	await act(async () => {
		await Promise.resolve();
	});
	await act(async () => {
		vi.advanceTimersByTime(1600);
	});
}

beforeEach(() => {
	vi.clearAllMocks();
	vi.useFakeTimers();
	mocks.params = {};
	mocks.completeHandoff.mockResolvedValue({ did: "did:plc:abc" });
	mocks.completeSession.mockResolvedValue({ did: "did:plc:abc" });
});

afterEach(() => {
	vi.useRealTimers();
});

describe("the auth/complete deep link", () => {
	it("redeems a handoff code and hands off to the index gate", async () => {
		mocks.params = { code: "handoff-code" };
		renderScreen();
		await settle();

		expect(mocks.completeHandoff).toHaveBeenCalledWith("handoff-code");
		expect(mocks.replace).toHaveBeenCalledWith("/");
	});

	it("routes an atstore grant back to the review screen", async () => {
		mocks.params = { code: "handoff-code", permission: "atstore" };
		renderScreen();
		await settle();

		expect(mocks.replace).toHaveBeenCalledWith("/atstore-review");
	});

	it("does not report a failure when something else claimed the handoff", async () => {
		// Android delivers one redirect twice. The auth session having finished
		// first is not a failure, and saying so would bounce a signed-in user to
		// the login screen.
		mocks.completeHandoff.mockRejectedValue(
			new NoPendingHandoffError("No pending sign-in to complete"),
		);
		mocks.params = { code: "handoff-code" };
		const renderer = renderScreen();
		await settle();

		expect(mocks.replace).toHaveBeenCalledWith("/");
		expect(visibleText(renderer)).not.toContain("Failed to complete");
	});

	it("reports a real exchange failure", async () => {
		mocks.completeHandoff.mockRejectedValue(new Error("network down"));
		vi.spyOn(console, "error").mockImplementation(() => {});
		mocks.params = { code: "handoff-code" };
		const renderer = renderScreen();
		await act(async () => {
			await Promise.resolve();
		});

		expect(visibleText(renderer)).toContain("Failed to complete sign in");
		await act(async () => {
			vi.advanceTimersByTime(1600);
		});
		expect(mocks.replace).toHaveBeenCalledWith("/login");
	});

	it("explains storage maintenance rather than blaming the sign-in", async () => {
		mocks.completeHandoff.mockRejectedValue({ status: 503 });
		vi.spyOn(console, "error").mockImplementation(() => {});
		mocks.params = { code: "handoff-code" };
		const renderer = renderScreen();
		await act(async () => {
			await Promise.resolve();
		});

		expect(visibleText(renderer)).toContain("maintenance");
	});

	it("falls back to the legacy session id", async () => {
		mocks.params = { session: "session-123" };
		renderScreen();
		await settle();

		expect(mocks.completeSession).toHaveBeenCalledWith("session-123");
		expect(mocks.completeHandoff).not.toHaveBeenCalled();
	});

	it("sends a redirect carrying nothing to the login screen", async () => {
		renderScreen();
		await settle();

		expect(mocks.replace).toHaveBeenCalledWith("/login");
	});

	describe("error codes", () => {
		it("explains an Apple signup failure in Apple's terms", async () => {
			// These reach the app only from the browser leg on Android, and the
			// screen used to answer all three with "an unexpected error occurred".
			mocks.params = { error: "apple_email_unverified" };
			const renderer = renderScreen();

			expect(visibleText(renderer)).toContain(
				"Apple hasn't verified that email address",
			);
			await settle();
			expect(mocks.replace).toHaveBeenCalledWith("/login");
		});

		it("still explains the core OAuth codes", async () => {
			mocks.params = { error: "permission_declined" };
			const renderer = renderScreen();

			expect(visibleText(renderer)).toContain(
				"Review permission was not granted",
			);
			await settle();
		});

		it("has something to say about a code it has never seen", async () => {
			mocks.params = { error: "something_new" };
			const renderer = renderScreen();

			expect(visibleText(renderer)).toContain("unexpected error");
			await settle();
		});

		it("never redeems a code when the redirect carried an error", async () => {
			mocks.params = { error: "apple_failed", code: "handoff-code" };
			renderScreen();
			await settle();

			expect(mocks.completeHandoff).not.toHaveBeenCalled();
		});
	});
});
