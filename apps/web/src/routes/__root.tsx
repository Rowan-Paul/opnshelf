import { configureApiClient } from "@opnshelf/api";
import { PostHogProvider, usePostHog } from "@posthog/react";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
	Scripts,
	useLocation,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import React from "react";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { env } from "@/env";
import Footer from "../components/Footer";
import Header from "../components/Header";
import TanStackQueryDevtools from "../integrations/tanstack-query/devtools";
import appCss from "../styles.css?url";

interface MyRouterContext {
	queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				title: "OpnShelf",
			},
		],
		links: [
			{
				rel: "stylesheet",
				href: appCss,
			},
		],
	}),

	component: RootComponent,
	shellComponent: RootDocument,
});

configureApiClient(env.VITE_API_URL);

function ScreenTracker() {
	const location = useLocation();
	const posthog = usePostHog();
	const previousPath = React.useRef<string | null>(null);

	React.useEffect(() => {
		const currentPath = location.pathname;
		if (previousPath.current !== currentPath) {
			posthog.capture("$pageview", {
				$pathname: currentPath,
				$previous_pathname: previousPath.current,
				$search: location.search,
			});
			previousPath.current = currentPath;
		}
	}, [location, posthog]);

	return null;
}

function RootComponent() {
	const { queryClient } = Route.useRouteContext();

	return (
		<QueryClientProvider client={queryClient}>
			<ThemeProvider>
				<ScreenTracker />
				<div className="min-h-screen flex flex-col">
					<Header />
					<main className="flex-1 flex flex-col min-h-0">
						<Outlet />
					</main>
					<Footer />
				</div>
				<TanStackDevtools
					config={{
						position: "bottom-right",
					}}
					plugins={[
						{
							name: "Tanstack Router",
							render: <TanStackRouterDevtoolsPanel />,
						},
						TanStackQueryDevtools,
					]}
				/>
				<Toaster />
			</ThemeProvider>
		</QueryClientProvider>
	);
}

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" className="dark">
			<head>
				<HeadContent />
			</head>
			<body>
				<PostHogProvider
					apiKey={env.VITE_PUBLIC_POSTHOG_KEY ?? ""}
					options={{
						api_host: "/ingest",
						ui_host: env.VITE_PUBLIC_POSTHOG_HOST || "https://eu.posthog.com",
						defaults: "2025-05-24",
						capture_exceptions: true,
						debug: import.meta.env.DEV,
					}}
				>
					{children}
				</PostHogProvider>
				<Scripts />
			</body>
		</html>
	);
}
