import { configureApiClient } from "@opnshelf/api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Route } from "./reviews.$handle.$rkey";

const state = vi.hoisted(() => ({
	authenticated: true,
	did: "viewer",
	review: {
		id: "r1",
		rkey: "1",
		author: { did: "author", handle: "author.test" },
		mediaType: "show",
		mediaId: "1",
		reviewTitle: "Review",
		markdown: "Body",
		createdAt: "2026-11-09",
		updatedAt: "2026-11-09",
	},
}));
vi.mock("@tanstack/react-router", async (importOriginal) => ({
	...(await importOriginal<typeof import("@tanstack/react-router")>()),
	createFileRoute: () => (options: object) => ({
		options,
		useParams: () => ({ handle: "author.test", rkey: "1" }),
		useLoaderData: () => ({ review: state.review }),
	}),
	Link: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
vi.mock("#/lib/auth-context", () => ({
	useAuth: () => ({
		isAuthenticated: state.authenticated,
		user: { did: state.did },
	}),
}));
vi.mock("#/integrations/posthog/provider", () => ({
	posthog: { capture: vi.fn() },
}));
vi.mock("#/lib/prompt-state", () => ({ useHydrated: () => true }));
vi.mock("#/components/SpoilerShield", () => ({
	SpoilerShield: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("#/components/MarkdownContent", () => ({
	MarkdownContent: () => null,
}));
vi.mock("#/components/following/UserAvatar", () => ({
	UserAvatar: () => null,
}));
let client: QueryClient;
let failLikes: boolean;
let delay: Promise<void> | undefined;
let writes: string[];
beforeEach(() => {
	state.authenticated = true;
	state.did = "viewer";
	failLikes = false;
	delay = undefined;
	writes = [];
	configureApiClient("http://fixture.test");
	client = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	});
	vi.stubGlobal(
		"fetch",
		vi.fn(async (request: Request) => {
			if (request.url.includes("/canonical/"))
				return Response.json(state.review);
			if (request.url.endsWith("/likes")) {
				await delay;
				return Response.json(
					failLikes
						? { message: "Unavailable" }
						: { items: [], total: 1, hasLiked: true },
					{ status: failLikes ? 503 : 200 },
				);
			}
			writes.push(request.method);
			return Response.json({ success: true });
		}),
	);
});
afterEach(() => {
	cleanup();
	client.clear();
	vi.unstubAllGlobals();
});
function page() {
	const Page = Route.options.component;
	if (!Page) throw new Error("Missing page");
	return render(
		<QueryClientProvider client={client}>
			<Page />
		</QueryClientProvider>,
	);
}
it("disables Like while viewer state loads and uses Unlike once loaded", async () => {
	let resolve!: () => void;
	delay = new Promise<void>((r) => {
		resolve = r;
	});
	page();
	expect(
		screen
			.getByRole("button", { name: "Like review" })
			.hasAttribute("disabled"),
	).toBe(true);
	fireEvent.click(screen.getByRole("button", { name: "Like review" }));
	expect(writes).toEqual([]);
	resolve();
	await waitFor(() =>
		expect(
			screen
				.getByRole("button", { name: "Unlike review" })
				.hasAttribute("disabled"),
		).toBe(false),
	);
});
it("blocks failed viewer state and recovers through Try again", async () => {
	failLikes = true;
	page();
	await screen.findByRole("button", { name: "Retry loading review likes" });
	expect(
		screen
			.getByRole("button", { name: "Like review" })
			.hasAttribute("disabled"),
	).toBe(true);
	failLikes = false;
	fireEvent.click(
		screen.getByRole("button", { name: "Retry loading review likes" }),
	);
	await waitFor(() =>
		expect(
			screen
				.getByRole("button", { name: "Unlike review" })
				.hasAttribute("disabled"),
		).toBe(false),
	);
	expect(writes).toEqual([]);
});
it.each([
	"signed out",
	"author",
])("keeps %s read only after likes load", async (viewer) => {
	state.authenticated = viewer !== "signed out";
	state.did = viewer === "author" ? "author" : "viewer";
	page();
	await screen.findByText("1");
	const button = screen.getByRole("button", {
		name: viewer === "signed out" ? "1 likes" : "Unlike review",
	});
	expect(button.hasAttribute("disabled")).toBe(true);
	fireEvent.click(button);
	expect(writes).toEqual([]);
});
