import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	appleNative: vi.fn(),
	googleNative: vi.fn(),
	appleAvailable: vi.fn(),
	appleSignIn: vi.fn(),
	googleSignIn: vi.fn(),
	hasPlayServices: vi.fn(),
	googleConfigure: vi.fn(),
	beginHandoff: vi.fn(),
	platform: { OS: "ios" as "ios" | "android" },
	env: {
		googleWebClientId: "web-client-id" as string | undefined,
		googleIosClientId: "ios-client-id" as string | undefined,
	},
}));

vi.mock("@opnshelf/api", () => ({
	authControllerAppleNative: mocks.appleNative,
	authControllerGoogleNative: mocks.googleNative,
}));

vi.mock("expo-apple-authentication", () => ({
	isAvailableAsync: mocks.appleAvailable,
	signInAsync: mocks.appleSignIn,
	AppleAuthenticationScope: { EMAIL: 0, FULL_NAME: 1 },
}));

vi.mock("@react-native-google-signin/google-signin", () => ({
	GoogleSignin: {
		configure: mocks.googleConfigure,
		hasPlayServices: mocks.hasPlayServices,
		signIn: mocks.googleSignIn,
	},
	isErrorWithCode: (error: unknown) =>
		Boolean(error && typeof error === "object" && "code" in error),
	statusCodes: { SIGN_IN_CANCELLED: "SIGN_IN_CANCELLED" },
}));

vi.mock("react-native", () => ({ Platform: mocks.platform }));
vi.mock("./auth-handoff", () => ({ beginHandoff: mocks.beginHandoff }));
vi.mock("./env", () => ({ env: mocks.env }));

/**
 * Imported fresh per test on purpose: the module latches `configureGoogle` the
 * first time it runs, so a stale instance would let one test's configuration
 * decide another's outcome.
 */
const load = () => import("./provider-signin");

beforeEach(() => {
	vi.resetModules();
	vi.clearAllMocks();
	// clearAllMocks keeps implementations, which would leak a cancellation or a
	// rejection into every test declared after the one that set it.
	mocks.appleSignIn.mockReset();
	mocks.googleSignIn.mockReset();
	mocks.platform.OS = "ios";
	mocks.env.googleWebClientId = "web-client-id";
	mocks.env.googleIosClientId = "ios-client-id";
	mocks.appleAvailable.mockResolvedValue(true);
	mocks.hasPlayServices.mockResolvedValue(true);
	mocks.beginHandoff.mockResolvedValue("challenge");
	mocks.appleNative.mockResolvedValue({ data: { redirectUrl: null } });
	mocks.googleNative.mockResolvedValue({ data: { redirectUrl: null } });
});

describe("where each provider can run natively", () => {
	it("offers native Apple only on iOS", async () => {
		const { supportsNativeApple } = await load();
		expect(supportsNativeApple()).toBe(true);
		mocks.platform.OS = "android";
		// Android falls back to the browser leg (ADR 0027) rather than hiding
		// Apple, which would lock out anyone who signed up on an iPhone.
		expect(supportsNativeApple()).toBe(false);
	});

	it("hides Google on iOS without an iOS client id", async () => {
		const { isGoogleConfigured } = await load();
		// The config plugin is only registered when that id exists, so the native
		// module would have no URL scheme to return to.
		mocks.env.googleIosClientId = undefined;
		expect(isGoogleConfigured()).toBe(false);
		mocks.platform.OS = "android";
		expect(isGoogleConfigured()).toBe(true);
	});

	it("hides Google everywhere without a web client id", async () => {
		const { isGoogleConfigured } = await load();
		mocks.env.googleWebClientId = undefined;
		expect(isGoogleConfigured()).toBe(false);
		mocks.platform.OS = "android";
		expect(isGoogleConfigured()).toBe(false);
	});
});

describe("signInWithProvider", () => {
	it("mints the handoff challenge before the exchange and sends it along", async () => {
		const { signInWithProvider } = await load();
		mocks.appleSignIn.mockResolvedValue({ identityToken: "apple-token" });
		mocks.appleNative.mockResolvedValue({
			data: { redirectUrl: "https://pds.test/consent" },
		});

		const result = await signInWithProvider("apple");

		// Without platform and challenge in the body the consent callback reads
		// the flow as web and redirects to the Web App (ADR 0026).
		expect(mocks.appleNative).toHaveBeenCalledWith({
			body: {
				identityToken: "apple-token",
				platform: "mobile",
				codeChallenge: "challenge",
			},
			throwOnError: true,
		});
		expect(result).toEqual({
			kind: "authorize",
			authorizationUrl: "https://pds.test/consent",
		});
	});

	it("still signs in when the backend cannot issue a challenge", async () => {
		const { signInWithProvider } = await load();
		mocks.beginHandoff.mockResolvedValue(null);
		mocks.googleSignIn.mockResolvedValue({
			type: "success",
			data: { idToken: "google-token" },
		});
		mocks.googleNative.mockResolvedValue({
			data: { pendingToken: "pending", email: "user@example.com" },
		});

		const result = await signInWithProvider("google");

		expect(mocks.googleNative).toHaveBeenCalledWith({
			body: {
				identityToken: "google-token",
				platform: "mobile",
				codeChallenge: undefined,
			},
			throwOnError: true,
		});
		expect(result).toEqual({
			kind: "register",
			pendingToken: "pending",
			email: "user@example.com",
		});
	});

	it("reports an Apple cancellation as a cancellation, not a failure", async () => {
		const { signInWithProvider } = await load();
		mocks.appleSignIn.mockRejectedValue(
			Object.assign(new Error("cancelled"), { code: "ERR_REQUEST_CANCELED" }),
		);

		await expect(signInWithProvider("apple")).resolves.toEqual({
			kind: "cancelled",
		});
		expect(mocks.appleNative).not.toHaveBeenCalled();
	});

	it("reports a Google cancellation as a cancellation, not a failure", async () => {
		const { signInWithProvider } = await load();
		mocks.googleSignIn.mockResolvedValue({ type: "cancelled" });

		await expect(signInWithProvider("google")).resolves.toEqual({
			kind: "cancelled",
		});
		expect(mocks.googleNative).not.toHaveBeenCalled();
	});

	it("does not treat a missing Apple token as a cancellation", async () => {
		const { signInWithProvider } = await load();
		// The user did authorise; silently backing out would hide a real failure.
		mocks.appleSignIn.mockResolvedValue({ identityToken: null });

		await expect(signInWithProvider("apple")).rejects.toThrow(
			"Apple returned no identity token",
		);
	});

	it("reports Apple being unavailable as its own error type", async () => {
		const { signInWithProvider, ProviderUnavailableError } = await load();
		mocks.appleAvailable.mockResolvedValue(false);

		await expect(signInWithProvider("apple")).rejects.toBeInstanceOf(
			ProviderUnavailableError,
		);
	});

	it("refuses to sign in with Google when no web client id is configured", async () => {
		const { signInWithProvider, ProviderUnavailableError } = await load();
		mocks.env.googleWebClientId = undefined;

		await expect(signInWithProvider("google")).rejects.toBeInstanceOf(
			ProviderUnavailableError,
		);
		expect(mocks.googleConfigure).not.toHaveBeenCalled();
	});

	it("hands the web client id to the native SDK as the token audience", async () => {
		const { signInWithProvider } = await load();
		mocks.googleSignIn.mockResolvedValue({
			type: "success",
			data: { idToken: "google-token" },
		});
		mocks.googleNative.mockResolvedValue({
			data: { pendingToken: "pending", email: "user@example.com" },
		});

		await signInWithProvider("google");

		// The PDS validates the id_token against the web client, not the iOS one.
		expect(mocks.googleConfigure).toHaveBeenCalledWith({
			webClientId: "web-client-id",
			iosClientId: "ios-client-id",
		});
	});

	it("refuses a response that continues nowhere", async () => {
		const { signInWithProvider } = await load();
		mocks.appleSignIn.mockResolvedValue({ identityToken: "apple-token" });
		mocks.appleNative.mockResolvedValue({ data: {} });

		await expect(signInWithProvider("apple")).rejects.toThrow(
			"Sign-in did not return anything to continue with",
		);
	});
});
