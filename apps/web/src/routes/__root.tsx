import { authControllerMeOptions, isUnauthorizedError } from "@opnshelf/api";
import { TanStackDevtools } from "@tanstack/react-devtools";
import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	redirect,
	Scripts,
	useRouterState,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { useEffect, useRef } from "react";
import { AccountDeletionGate } from "#/components/AccountDeletionGate";
import { Toaster } from "#/components/ui/sonner";
import { ssrAuthOptions } from "#/lib/api";
import { AuthProvider } from "#/lib/auth-context";
import { SearchDialogProvider } from "#/lib/search-dialog-context";
import {
	DefaultErrorComponent,
	NotFoundComponent,
} from "../components/ErrorBoundary";
import Footer from "../components/Footer";
import Header from "../components/Header";
import { TraktSyncBanner } from "../components/trakt/TraktSyncBanner";
import PostHogProvider, { posthog } from "../integrations/posthog/provider";
import TanStackQueryDevtools from "../integrations/tanstack-query/devtools";
import appCss from "../styles.css?url";

interface MyRouterContext {
	queryClient: QueryClient;
}

const THEME_INIT_SCRIPT = `(() => {try{const s=localStorage.getItem('theme'),m=s==='light'||s==='dark'||s==='auto'?s:'auto',d=window.matchMedia('(prefers-color-scheme: dark)').matches,r=m==='auto'?(d?'dark':'light'):m;document.documentElement.classList.remove('light','dark');document.documentElement.classList.add(r);m!=='auto'&&document.documentElement.setAttribute('data-theme',m);document.documentElement.style.colorScheme=r;}catch(e){}})()`;

export const Route = createRootRouteWithContext<MyRouterContext>()({
	beforeLoad: async ({ context, location }) => {
		// Allow onboarding, login, auth callback, and embed pages without redirect.
		// `/embed/*` is chromeless and consumed inside the mobile app's WebView, so
		// it must never bounce to onboarding.
		if (
			location.pathname === "/onboarding" ||
			location.pathname === "/login" ||
			location.pathname === "/auth/complete" ||
			location.pathname.startsWith("/embed")
		) {
			return;
		}

		try {
			const user = await context.queryClient.fetchQuery(
				authControllerMeOptions(ssrAuthOptions()),
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
			{ title: "Opnshelf - Track What You Watch" },
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
	// `/embed/*` pages render chromeless (no header/footer/banner) because they
	// are embedded inside the mobile app's WebView, not browsed directly.
	const isEmbed = useRouterState({
		select: (s) => s.location.pathname.startsWith("/embed"),
	});
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				{/* biome-ignore lint/security/noDangerouslySetInnerHtml: Theme script must be inline to prevent FOUC */}
				<script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
				<HeadContent />
			</head>
			<body className="min-h-screen antialiased">
				<PostHogProvider>
					<PostHogPageviewTracker />
					<AuthProvider>
						<SearchDialogProvider>
							{isEmbed ? (
								children
							) : (
								<div className="flex min-h-screen flex-col">
									<Header />
									<TraktSyncBanner />
									<main className="flex-1">{children}</main>
									<Footer />
								</div>
							)}
							<AccountDeletionGate />
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

/** Tracks client-side route changes; PostHog's automatic page views are disabled. */
function PostHogPageviewTracker() {
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const routeSection = pathname.split("/")[1] || "home";
	const previousRouteSection = useRef<string | null>(null);

	useEffect(() => {
		posthog.capture("$pageview", {
			// Do not send query strings or dynamic path segments, which can contain
			// credentials or user-generated identifiers.
			$current_url: window.location.origin,
			$pathname: `/${routeSection}`,
			previous_route_section: previousRouteSection.current,
		});
		previousRouteSection.current = routeSection;
	}, [routeSection]);

	return null;
}
