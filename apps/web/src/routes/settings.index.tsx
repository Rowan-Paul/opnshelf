import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import {
	SETTINGS_AREAS,
	SettingsPageShell,
} from "#/components/settings/SettingsPageShell";

export const Route = createFileRoute("/settings/")({
	component: SettingsPage,
});

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
