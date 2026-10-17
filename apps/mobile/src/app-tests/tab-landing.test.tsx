import { createElement, type PropsWithChildren } from "react";
import {
	act,
	create,
	type ReactTestInstance,
	type ReactTestRenderer,
} from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TabLayout from "@/app/(tabs)/_layout";
import HomeRoute from "@/app/(tabs)/index";

const mocks = vi.hoisted(() => ({
	push: vi.fn(),
	auth: {
		user: null as null | {
			did: string;
			avatar?: string;
			needsEmailVerification?: boolean;
			needsOnboarding?: boolean;
		},
		isAuthenticated: false,
		isLoading: false,
	},
}));
function host(name: string) {
	return ({ children, ...props }: PropsWithChildren) =>
		createElement(name, props, children);
}
vi.mock("expo-router", () => ({
	Redirect: host("redirect"),
	router: { push: mocks.push },
	Tabs: Object.assign(host("tabs"), {
		Screen: host("tab-screen"),
		Protected: ({ guard, children }: PropsWithChildren<{ guard: boolean }>) =>
			guard ? children : null,
	}),
}));
vi.mock("react-native", () => ({
	ActivityIndicator: host("pending"),
	View: host("view"),
	useColorScheme: () => "dark",
}));
vi.mock("expo-image", () => ({ Image: host("image") }));
vi.mock("lucide-react-native", () => ({
	Compass: host("compass"),
	Home: host("home-icon"),
	LogIn: host("login-icon"),
	User: host("user-icon"),
	Users: host("users-icon"),
}));
vi.mock("@/theme", () => ({
	darkNavTheme: { colors: {} },
	lightNavTheme: { colors: {} },
}));
vi.mock("@/lib/auth-context", () => ({ useAuth: () => mocks.auth }));
vi.mock("@/components/home/HomeScreen", () => ({ default: host("home") }));
vi.mock("@/components/feedback/ShakeToFeedback", () => ({
	ShakeToFeedback: () => null,
}));
vi.mock("@/components/trakt/TraktSyncBanner", () => ({
	TraktSyncBanner: host("banner"),
}));

function hosts(root: ReactTestInstance, name: string) {
	return root.findAll(
		(node) => typeof node.type === "string" && node.type === name,
	);
}

let rendered: ReactTestRenderer;
function render(element: React.ReactElement) {
	act(() => {
		rendered = create(element);
	});
	return rendered.root;
}

beforeEach(() => {
	mocks.push.mockReset();
	mocks.auth = { user: null, isAuthenticated: false, isLoading: false };
});

describe("URL-based Mobile App landing", () => {
	it("redirects guest / to Discover without mounting Home", () => {
		const root = render(<HomeRoute />);
		expect(hosts(root, "redirect")[0].props.href).toBe("/search");
		expect(hosts(root, "home")).toHaveLength(0);
	});

	it("renders Home for authenticated /", () => {
		mocks.auth.user = { did: "did:plc:fixture" };
		mocks.auth.isAuthenticated = true;
		expect(hosts(render(<HomeRoute />), "home")).toHaveLength(1);
	});

	it("does not mount Home when authentication has expired", () => {
		mocks.auth.user = { did: "did:plc:fixture" };
		expect(hosts(render(<HomeRoute />), "redirect")[0].props.href).toBe(
			"/search",
		);
	});

	it("leaves accessible destinations to the URL and hides guest Home and Social", () => {
		const root = render(<TabLayout />);
		expect(hosts(root, "redirect")).toHaveLength(0);
		const tabs = hosts(root, "tab-screen");
		expect(tabs.map((tab) => tab.props.name)).toEqual([
			"index",
			"search",
			"profile",
		]);
		expect(tabs[0].props.options.href).toBeNull();
		expect(tabs[2].props.options.title).toBe("Sign in");
		const event = { preventDefault: vi.fn() };
		tabs[2].props.listeners.tabPress(event);
		expect(event.preventDefault).toHaveBeenCalledOnce();
		expect(mocks.push).toHaveBeenCalledWith("/login");
	});

	it("preserves authenticated tabs and the Profile avatar", () => {
		mocks.auth.user = {
			did: "did:plc:fixture",
			avatar: "https://example.test/avatar",
		};
		mocks.auth.isAuthenticated = true;
		const root = render(<TabLayout />);
		const tabs = hosts(root, "tab-screen");
		expect(tabs.map((tab) => tab.props.name)).toEqual([
			"index",
			"search",
			"social",
			"profile",
		]);
		const avatar = render(
			tabs[3].props.options.tabBarIcon({ size: 24, focused: true }),
		);
		expect(hosts(avatar, "image")[0].props.source.uri).toBe(
			"https://example.test/avatar",
		);
	});

	it.each([
		[{ needsEmailVerification: true, needsOnboarding: true }, "/verify-email"],
		[{ needsOnboarding: true }, "/onboarding"],
	])("preserves the account gate %j", (flags, destination) => {
		mocks.auth.user = { did: "did:plc:fixture", ...flags };
		mocks.auth.isAuthenticated = true;
		expect(hosts(render(<TabLayout />), "redirect")[0].props.href).toBe(
			destination,
		);
	});

	it("waits for session restoration before mounting tabs", () => {
		mocks.auth.isLoading = true;
		const root = render(<TabLayout />);
		expect(hosts(root, "tabs")).toHaveLength(0);
		expect(hosts(root, "pending")).toHaveLength(1);
	});
});
