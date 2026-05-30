import { authControllerMeOptions } from "@opnshelf/api";
import { TanStackDevtools } from "@tanstack/react-devtools";
import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	redirect,
	Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { Toaster } from "#/components/ui/sonner";
import { AuthProvider } from "#/lib/auth-context";
import { SearchDialogProvider } from "#/lib/search-dialog-context";
import {
	DefaultErrorComponent,
	NotFoundComponent,
} from "../components/ErrorBoundary";
import Footer from "../components/Footer";
import Header from "../components/Header";
import PostHogProvider from "../integrations/posthog/provider";
import TanStackQueryDevtools from "../integrations/tanstack-query/devtools";
import appCss from "../styles.css?url";

interface MyRouterContext {
	queryClient: QueryClient;
}

const THEME_INIT_SCRIPT = `(() => {try{const s=localStorage.getItem('theme'),m=s==='light'||s==='dark'||s==='auto'?s:'auto',d=window.matchMedia('(prefers-color-scheme: dark)').matches,r=m==='auto'?(d?'dark':'light'):m;document.documentElement.classList.remove('light','dark');document.documentElement.classList.add(r);m!=='auto'&&document.documentElement.setAttribute('data-theme',m);document.documentElement.style.colorScheme=r;}catch(e){}})()`;

function isUnauthorizedError(error: unknown): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		("status" in error || "statusCode" in error) &&
		((error as Record<string, unknown>).status === 401 ||
			(error as Record<string, unknown>).statusCode === 401)
	);
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
	beforeLoad: async ({ context, location }) => {
		// Allow onboarding, login, and auth callback pages without redirect
		if (
			location.pathname === "/onboarding" ||
			location.pathname === "/login" ||
			location.pathname === "/auth/complete"
		) {
			return;
		}

		try {
			const user = await context.queryClient.fetchQuery(
				authControllerMeOptions(),
			);
			if (user?.needsOnboarding) {
				throw redirect({ to: "/onboarding" });
			}
		} catch (error) {
			if (isUnauthorizedError(error)) {
				// Not logged in — allow access to public pages
				return;
			}
			throw error;
		}
	},
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "OpnShelf - Track What You Watch" },
			{
				name: "description",
				content:
					"Track what you watch and discover what others are watching. A personal media tracker built on the AT Protocol.",
			},
		],
		links: [
			{ rel: "stylesheet", href: appCss },
			{ rel: "icon", type: "image/png", href: "/favicon.png" },
			{ rel: "apple-touch-icon", href: "/icon.png" },
			{ rel: "manifest", href: "/manifest.json" },
		],
	}),
	errorComponent: DefaultErrorComponent,
	notFoundComponent: NotFoundComponent,
	shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				{/* biome-ignore lint/security/noDangerouslySetInnerHtml: Theme script must be inline to prevent FOUC */}
				<script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
				<HeadContent />
			</head>
			<body className="min-h-screen antialiased">
				<PostHogProvider>
					<AuthProvider>
						<SearchDialogProvider>
							<div className="flex min-h-screen flex-col">
								<Header />
								<main className="flex-1">{children}</main>
								<Footer />
							</div>
							<Toaster />
						</SearchDialogProvider>
					</AuthProvider>
					<TanStackDevtools
						config={{ position: "bottom-right" }}
						plugins={[
							{
								name: "Tanstack Router",
								render: <TanStackRouterDevtoolsPanel />,
							},
							TanStackQueryDevtools,
						]}
					/>
				</PostHogProvider>
				<Scripts />
			</body>
		</html>
	);
}
