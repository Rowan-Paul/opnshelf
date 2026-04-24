import { TanStackDevtools } from "@tanstack/react-devtools";
import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { AuthProvider } from "#/lib/auth-context";
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

export const Route = createRootRouteWithContext<MyRouterContext>()({
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
		links: [{ rel: "stylesheet", href: appCss }],
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
						<div className="flex min-h-screen flex-col">
							<Header />
							<main className="flex-1">{children}</main>
							<Footer />
						</div>
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
