import { authControllerMeOptions, isUnauthorizedError } from "@opnshelf/api";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { Loader2, Settings } from "lucide-react";
import { useEffect } from "react";
import { AccountSection } from "#/components/settings/AccountSection";
import { BlogMirrorSection } from "#/components/settings/BlogMirrorSection";
import { BlueskyCrossPostsSection } from "#/components/settings/BlueskyCrossPostsSection";
import { DeleteAccountSection } from "#/components/settings/DeleteAccountSection";
import { DevicesSection } from "#/components/settings/DevicesSection";
import { ImportHistorySection } from "#/components/settings/ImportHistorySection";
import { PreferencesSections } from "#/components/settings/PreferencesSections";
import { ssrAuthOptions } from "#/lib/api";
import { useAuth } from "#/lib/auth-context";

const NAV_SECTIONS = [
	["time-region", "Time & Region"],
	["streaming", "Streaming"],
	["reading", "Reading"],
	["import-history", "Import history"],
	["blog-mirror", "Blog mirror"],
	["account", "Account"],
	["danger-zone", "Danger Zone"],
];

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

function SettingsPage() {
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
			{/* Page Header */}
			<div className="mb-8 flex items-center gap-3 lg:ml-56">
				<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-(--accent-subtle) text-(--accent)">
					<Settings className="size-5" />
				</div>
				<div>
					<h1 className="text-display-2">Settings</h1>
					<p className="text-(--foreground-muted)">
						Manage your account and preferences
					</p>
				</div>
			</div>

			<div className="lg:grid lg:grid-cols-[12rem_minmax(0,1fr)] lg:items-start lg:gap-10">
				<aside className="sticky top-24 hidden lg:block">
					<nav aria-label="Settings sections" className="space-y-1">
						{NAV_SECTIONS.map(([id, label]) => (
							<a
								key={id}
								href={`#${id}`}
								className="block rounded-lg px-3 py-2 font-medium text-(--foreground-muted) text-sm transition-colors hover:bg-(--background-subtle) hover:text-(--foreground) focus-visible:outline-none focus-visible:ring-(--accent) focus-visible:ring-2"
							>
								{label}
							</a>
						))}
					</nav>
				</aside>

				<div className="min-w-0 space-y-4">
					<div className="card overflow-hidden">
						<PreferencesSections />
						<ImportHistorySection />
						<BlogMirrorSection />
						<BlueskyCrossPostsSection />
						<DevicesSection />
						<AccountSection user={user} />
					</div>

					<DeleteAccountSection />
				</div>
			</div>
		</div>
	);
}
