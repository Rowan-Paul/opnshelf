import { createFileRoute, notFound } from "@tanstack/react-router";
import { AccountSection } from "#/components/settings/AccountSection";
import { BlogMirrorSection } from "#/components/settings/BlogMirrorSection";
import { BlueskyCrossPostsSection } from "#/components/settings/BlueskyCrossPostsSection";
import { DeleteAccountSection } from "#/components/settings/DeleteAccountSection";
import { DevicesSection } from "#/components/settings/DevicesSection";
import { HelpSection } from "#/components/settings/HelpSection";
import { ImportHistorySection } from "#/components/settings/ImportHistorySection";
import { PreferencesSections } from "#/components/settings/PreferencesSections";
import { useAuth } from "#/lib/auth-context";
import { SettingsPageShell } from "./settings";

const SECTION_COPY = {
	profile: {
		title: "Profile",
		description: "Update the details people see on Opnshelf.",
	},
	preferences: {
		title: "Preferences",
		description: "Choose how Opnshelf looks and works for you.",
	},
	connections: {
		title: "Connections",
		description:
			"Manage optional services that work with your Reviews and Shelf.",
	},
	account: {
		title: "Account",
		description: "Manage where you are signed in and your account.",
	},
	help: {
		title: "Help",
		description: "Revisit the tour and find ways to get in touch.",
	},
} as const;

export const Route = createFileRoute("/settings/$section")({
	beforeLoad: ({ params }) => {
		if (!(params.section in SECTION_COPY)) throw notFound();
	},
	component: SettingsSectionPage,
});

function SettingsSectionPage() {
	const { section } = Route.useParams();
	const { user, logout } = useAuth();
	const copy = SECTION_COPY[section as keyof typeof SECTION_COPY];

	return (
		<SettingsPageShell {...copy}>
			<div className="card overflow-hidden">
				{section === "profile" && user ? <AccountSection user={user} /> : null}
				{section === "preferences" ? <PreferencesSections /> : null}
				{section === "connections" ? (
					<>
						<BlogMirrorSection />
						<BlueskyCrossPostsSection />
						<ImportHistorySection />
					</>
				) : null}
				{section === "account" ? (
					<>
						<DevicesSection />
						<div className="border-(--border) border-t p-5 sm:p-7">
							<button
								type="button"
								className="btn btn-secondary"
								onClick={() => void logout()}
							>
								Sign out
							</button>
						</div>
					</>
				) : null}
				{section === "help" ? <HelpSection /> : null}
			</div>
			{section === "account" ? <DeleteAccountSection /> : null}
		</SettingsPageShell>
	);
}
