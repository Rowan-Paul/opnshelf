import { authControllerMeOptions, isUnauthorizedError } from "@opnshelf/api";
import {
	createFileRoute,
	Link,
	redirect,
	useNavigate,
} from "@tanstack/react-router";
import {
	ChevronRight,
	CircleHelp,
	Loader2,
	PlugZap,
	Settings,
	ShieldCheck,
	SlidersHorizontal,
	UserRound,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { ssrAuthOptions } from "#/lib/api";
import { useAuth } from "#/lib/auth-context";

const SETTINGS_AREAS = [
	{
		section: "profile",
		label: "Profile",
		description: "Your name, photo and social links",
		Icon: UserRound,
	},
	{
		section: "preferences",
		label: "Preferences",
		description: "Appearance, time, streaming and reviews",
		Icon: SlidersHorizontal,
	},
	{
		section: "connections",
		label: "Connections",
		description: "Blog mirroring, Bluesky and Trakt",
		Icon: PlugZap,
	},
	{
		section: "account",
		label: "Account",
		description: "Devices, sign out and account deletion",
		Icon: ShieldCheck,
	},
	{
		section: "help",
		label: "Help",
		description: "Welcome tour and feedback",
		Icon: CircleHelp,
	},
] as const;

export const Route = createFileRoute("/settings")({
	beforeLoad: async ({ context }) => {
		try {
			await context.queryClient.fetchQuery(
				authControllerMeOptions(ssrAuthOptions()),
			);
		} catch (error) {
			if (isUnauthorizedError(error)) {
				throw redirect({
					to: "/login",
					search: { message: "Please log in to view settings" },
				});
			}
			throw error;
		}
	},
	head: () => ({
		meta: [{ title: "Settings | Opnshelf" }],
	}),
	component: SettingsPage,
});

export function SettingsPageShell({
	children,
	title = "Settings",
	description = "Manage your account and preferences",
}: {
	children: ReactNode;
	title?: string;
	description?: string;
}) {
	const { user, isAuthenticated, isLoading: authLoading } = useAuth();
	const navigate = useNavigate();

	// Redirect if not authenticated
	useEffect(() => {
		if (!authLoading && !isAuthenticated) {
			navigate({ to: "/login" });
		}
	}, [authLoading, isAuthenticated, navigate]);

	if (authLoading) {
		return (
			<div className="container-app flex min-h-[50vh] items-center justify-center py-8">
				<Loader2 className="size-8 animate-spin text-(--accent)" />
			</div>
		);
	}

	if (!isAuthenticated || !user) {
		return null;
	}

	return (
		<div className="container-app max-w-5xl py-8 sm:py-10">
			<div className="mb-8 flex items-center gap-3 lg:ml-56">
				<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-(--accent-subtle) text-(--accent)">
					<Settings className="size-5" />
				</div>
				<div>
					<h1 className="text-display-2">{title}</h1>
					<p className="text-(--foreground-muted)">{description}</p>
				</div>
			</div>

			<div className="lg:grid lg:grid-cols-[12rem_minmax(0,1fr)] lg:items-start lg:gap-10">
				<aside className="sticky top-24 hidden lg:block">
					<nav aria-label="Settings" className="space-y-1">
						{SETTINGS_AREAS.map(({ section, label }) => (
							<Link
								key={section}
								to="/settings/$section"
								params={{ section }}
								activeProps={{
									className: "bg-(--accent-subtle) text-(--accent)",
								}}
								className="block rounded-lg px-3 py-2 font-medium text-(--foreground-muted) text-sm transition-colors hover:bg-(--background-subtle) hover:text-(--foreground) focus-visible:outline-none focus-visible:ring-(--accent) focus-visible:ring-2"
							>
								{label}
							</Link>
						))}
					</nav>
				</aside>
				<div className="min-w-0">{children}</div>
			</div>
		</div>
	);
}

function SettingsPage() {
	return (
		<SettingsPageShell>
			<div className="card overflow-hidden">
				{SETTINGS_AREAS.map(({ section, label, description, Icon }, index) => (
					<Link
						key={section}
						to="/settings/$section"
						params={{ section }}
						className={`group flex items-center gap-4 p-5 transition-colors hover:bg-(--background-subtle) focus-visible:outline-none focus-visible:ring-(--accent) focus-visible:ring-2 sm:p-6 ${
							index > 0 ? "border-(--border) border-t" : ""
						}`}
					>
						<div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-(--background-subtle) text-(--accent) group-hover:bg-(--accent-subtle)">
							<Icon className="size-5" />
						</div>
						<div className="min-w-0 flex-1">
							<h2 className="font-semibold">{label}</h2>
							<p className="mt-0.5 text-(--foreground-muted) text-sm">
								{description}
							</p>
						</div>
						<ChevronRight className="size-5 text-(--foreground-muted) transition-transform group-hover:translate-x-0.5" />
					</Link>
				))}
			</div>
		</SettingsPageShell>
	);
}
