import { Link, useNavigate } from "@tanstack/react-router";
import {
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
import { useAuth } from "#/lib/auth-context";

export const SETTINGS_AREAS = [
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
