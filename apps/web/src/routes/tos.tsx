import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/tos")({
	head: () => ({
		meta: [
			{ title: "Terms of Service | Opnshelf" },
			{
				name: "description",
				content: "Terms of Service for Opnshelf.",
			},
		],
	}),
	component: TermsOfServicePage,
});

function TermsOfServicePage() {
	return (
		<div className="container-app py-12">
			<div className="mx-auto max-w-3xl">
				<h1 className="mb-2 text-display-1">Terms of Service</h1>
				<p className="mb-10 text-(--foreground-muted) text-sm">
					Last updated: May 2026
				</p>

				<div className="prose-content space-y-8 text-(--foreground-muted)">
					<section className="space-y-3">
						<h2 className="text-(--foreground) text-display-3">
							1. Acceptance of Terms
						</h2>
						<p>
							By accessing or using Opnshelf ("the Service"), you agree to be
							bound by these Terms of Service. If you do not agree to these
							terms, please do not use the Service.
						</p>
					</section>

					<section className="space-y-3">
						<h2 className="text-(--foreground) text-display-3">
							2. Description of Service
						</h2>
						<p>
							Opnshelf is a personal media tracking application built on the AT
							Protocol. It allows you to track movies and TV shows you have
							watched, discover what others are watching, and manage a personal
							media shelf.
						</p>
						<p>
							The Service integrates with The Movie Database (TMDB) for media
							metadata and uses your AT Protocol identity (such as a Bluesky
							handle) for authentication.
						</p>
					</section>

					<section className="space-y-3">
						<h2 className="text-(--foreground) text-display-3">
							3. Your Account
						</h2>
						<p>
							You sign in using your existing AT Protocol account (e.g., a
							Bluesky account). You are responsible for maintaining the security
							of your AT Protocol credentials. Opnshelf does not store your
							password.
						</p>
						<p>You must be at least 13 years of age to use the Service.</p>
					</section>

					<section className="space-y-3">
						<h2 className="text-(--foreground) text-display-3">
							4. Acceptable Use
						</h2>
						<p>You agree not to:</p>
						<ul className="ml-6 list-disc space-y-1">
							<li>Use the Service for any unlawful purpose</li>
							<li>
								Attempt to reverse engineer, disrupt, or interfere with the
								Service
							</li>
							<li>
								Scrape or harvest data from the Service in an automated fashion
								without permission
							</li>
							<li>Impersonate another person or entity through the Service</li>
						</ul>
					</section>

					<section className="space-y-3">
						<h2 className="text-(--foreground) text-display-3">
							5. Intellectual Property
						</h2>
						<p>
							Media metadata (titles, posters, descriptions) is sourced from The
							Movie Database (TMDB) and is subject to their terms and
							conditions. The Opnshelf application code and branding are owned
							by Rowan Paul Flynn.
						</p>
						<p>
							Content you add to your shelf (watch history, ratings, notes, and
							lists) remains yours. By using the Service, you grant Opnshelf a
							limited licence to store and display that content to you and,
							where applicable, to users you follow or who follow you.
						</p>
					</section>

					<section className="space-y-3">
						<h2 className="text-(--foreground) text-display-3">
							6. Disclaimer of Warranties
						</h2>
						<p>
							The Service is provided "as is" and "as available" without
							warranties of any kind, either express or implied. We do not
							guarantee that the Service will be uninterrupted, error-free, or
							that any data will be permanently retained.
						</p>
					</section>

					<section className="space-y-3">
						<h2 className="text-(--foreground) text-display-3">
							7. Limitation of Liability
						</h2>
						<p>
							To the maximum extent permitted by law, Opnshelf and its creator
							shall not be liable for any indirect, incidental, or consequential
							damages arising from your use of the Service.
						</p>
					</section>

					<section className="space-y-3">
						<h2 className="text-(--foreground) text-display-3">8. Changes</h2>
						<p>
							We reserve the right to update these Terms at any time. Continued
							use of the Service after changes constitutes acceptance of the new
							Terms.
						</p>
					</section>

					<section className="space-y-3">
						<h2 className="text-(--foreground) text-display-3">9. Contact</h2>
						<p>
							For questions about these Terms, please reach out via{" "}
							<a
								href="https://bsky.app/profile/opnshelf.xyz"
								target="_blank"
								rel="noopener noreferrer"
								className="text-(--accent) hover:underline"
							>
								Bluesky
							</a>
							.
						</p>
					</section>
				</div>

				<div className="mt-12 border-(--border) border-t pt-8">
					<Link
						to="/privacy"
						className="text-(--accent) text-sm hover:underline"
					>
						Read our Privacy Policy →
					</Link>
				</div>
			</div>
		</div>
	);
}
