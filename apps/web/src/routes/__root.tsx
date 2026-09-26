import interFont from "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url";
import jakartaFont from "@fontsource-variable/plus-jakarta-sans/files/plus-jakarta-sans-latin-wght-normal.woff2?url";
import type { UserDto } from "@opnshelf/api";
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
import { MobileAppBanner } from "#/components/MobileAppBanner";
import { WelcomeTour } from "#/components/tour/WelcomeTour";
import { Toaster } from "#/components/ui/sonner";
import { ssrAuthOptions, ssrCanResolveSession } from "#/lib/api";
import { APP_BANNER_SCRIPT } from "#/lib/app-banner";
import { AuthProvider } from "#/lib/auth-context";
import { currentUserQueryOptions } from "#/lib/auth-query";
import { SearchDialogProvider } from "#/lib/search-dialog-context";
import { mayBeSignedIn, SIGNED_IN_HINT_QUERY_KEY } from "#/lib/session-hint";
import {
	DefaultErrorComponent,
	NotFoundComponent,
} from "../components/ErrorBoundary";
import Footer from "../components/Footer";
import Header from "../components/Header";
import { TraktSyncBanner } from "../components/trakt/TraktSyncBanner";
import { posthog } from "../integrations/posthog/provider";
import TanStackQueryDevtools from "../integrations/tanstack-query/devtools";
import appCss from "../styles.css?url";

interface MyRouterContext {
	queryClient: QueryClient;
}

const THEME_INIT_SCRIPT = `(() => {try{const s=localStorage.getItem('theme'),m=s==='light'||s==='dark'||s==='auto'?s:'auto',d=window.matchMedia('(prefers-color-scheme: dark)').matches,r=m==='auto'?(d?'dark':'light'):m;document.documentElement.classList.remove('light','dark');document.documentElement.classList.add(r);m!=='auto'&&document.documentElement.setAttribute('data-theme',m);document.documentElement.style.colorScheme=r;}catch(e){}})()`;

export const Route = createRootRouteWithContext<MyRouterContext>()({
	beforeLoad: async ({ context, location }) => {
		// Dehydrated with the rest of the cache, so AuthProvider hydrates with
		// the same answer SSR rendered with (ADR 0039).
		if (
			context.queryClient.getQueryData(SIGNED_IN_HINT_QUERY_KEY) === undefined
		) {
			context.queryClient.setQueryData(
				SIGNED_IN_HINT_QUERY_KEY,
				mayBeSignedIn(),
			);
		}
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

		const sessionQuery = currentUserQueryOptions(ssrAuthOptions());
		if (!ssrCanResolveSession()) {
			// No session cookie to forward, so the API could only answer 401.
			// Record the signed-out result it would have cached instead of asking;
			// AuthProvider verifies the browser session on mount either way. The
			// generated key is tagged with UserDto, so copy it untagged to seed null.
			context.queryClient.setQueryData<UserDto | null>(
				[...sessionQuery.queryKey],
				null,
			);
			return;
		}

		let user: UserDto | null;
		try {
			user = await context.queryClient.fetchQuery(sessionQuery);
		} catch {
			// SSR cannot establish the session; keep the page available and let
			// AuthProvider check again in the browser.
			return;
		}
		if (user?.needsOnboarding) {
			throw redirect({ to: "/onboarding" });
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
					"Track what you watch and discover what others are watching. Log movies and shows, and share your taste with friends.",
			},
			// Apple's Smart App Banner. Only iOS Safari renders it, and only it
			// knows whether the app is already installed, so it shows "OPEN"
			// rather than nagging an existing user. Every other mobile browser
			// gets our own MobileAppBanner instead.
			// ponytail: not gated to non-landing routes like our Banner is. A head
			// tag has no route context here, and it is inert everywhere else.
			{ name: "apple-itunes-app", content: "app-id=6758867162" },
		],
		links: [
			{ rel: "stylesheet", href: appCss },
			// Found only once the stylesheet is parsed otherwise; the Latin
			// subsets cover nearly every page.
			...[interFont, jakartaFont].map((href) => ({
				rel: "preload",
				href,
				as: "font",
				type: "font/woff2",
				crossOrigin: "anonymous" as const,
			})),
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
				{/* biome-ignore lint/security/noDangerouslySetInnerHtml: must run before the body paints so the Mobile App Banner never appears late */}
				<script dangerouslySetInnerHTML={{ __html: APP_BANNER_SCRIPT }} />
				<HeadContent />
			</head>
			<body className="min-h-screen antialiased">
				<PostHogPageviewTracker />
				<AuthProvider>
					<SearchDialogProvider>
						{isEmbed ? (
							children
						) : (
							<div className="flex min-h-screen flex-col">
								<Header />
								<TraktSyncBanner />
								<MobileAppBanner />
								<main className="flex-1">{children}</main>
								<Footer />
							</div>
						)}
						<AccountDeletionGate />
						{/* Above the router: the tour walks the user across routes
						    and has to survive each change (ADR 0024). */}
						{!isEmbed && <WelcomeTour />}
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
