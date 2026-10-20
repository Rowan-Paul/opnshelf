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
}));
vi.mock("expo-router/native-tabs", () => ({
	NativeTabs: Object.assign(host("tabs"), {
		Trigger: Object.assign(host("tab-screen"), {
			Label: host("label"),
			Icon: host("icon"),
		}),
	}),
}));
vi.mock("@/components/navigation/native-tab-avatar", () => ({
	NativeTabAvatar: host("avatar"),
}));
vi.mock("@/components/navigation/tab-icons", () => ({
	tabIcons: { home: 1, discover: 2, social: 3, profile: 4, login: 5 },
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
		expect(
			tabs.filter((tab) => !tab.props.hidden).map((tab) => tab.props.name),
		).toEqual(["search", "profile"]);
		const profile = tabs[3];
		expect(profile?.props.disabled).toBe(true);
		expect(hosts(profile, "label")[0].children).toEqual(["Sign in"]);
		profile?.props.listeners.tabPress();
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
		expect(tabs[3].props.disabled).toBe(false);
		expect(hosts(root, "avatar")[0].props.uri).toBe(
			"https://example.test/avatar",
		);
		act(() =>
			hosts(root, "avatar")[0].props.onReady({
				default: { uri: "normal" },
				selected: { uri: "selected" },
			}),
		);
		const profile = hosts(rendered.root, "tab-screen")[3];
		expect(profile.props.unstable_nativeProps.android.icon.tinting).toBe(
			"original",
		);
		expect(hosts(profile, "icon")[0].props.renderingMode).toBe("original");
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
