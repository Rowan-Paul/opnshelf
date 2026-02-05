import { configureApiClient, setOnUnauthorized } from "@opnshelf/api";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
	Scripts,
	useNavigate,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { useEffect } from "react";
import { env } from "@/env";
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

function RootComponent() {
	const { queryClient } = Route.useRouteContext();
	const navigate = useNavigate();

	useEffect(() => {
		setOnUnauthorized(() => {
			queryClient.invalidateQueries({ queryKey: ["auth"] });
			navigate({
				to: "/login",
				search: { reason: "session_expired" },
				replace: true,
			});
		});
		return () => setOnUnauthorized(null);
	}, [queryClient, navigate]);

	return (
		<QueryClientProvider client={queryClient}>
			<div className="min-h-screen flex flex-col">
				<Header />
				<main className="flex-1 flex flex-col min-h-0">
					<Outlet />
				</main>
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
		</QueryClientProvider>
	);
}

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<head>
				<HeadContent />
			</head>
			<body>
				{children}
				<Scripts />
			</body>
		</html>
	);
}
