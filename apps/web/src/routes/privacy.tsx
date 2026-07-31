import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
	head: () => ({
		meta: [
			{ title: "Privacy Policy | Opnshelf" },
			{
				name: "description",
				content: "Privacy Policy for Opnshelf.",
			},
		],
	}),
	component: PrivacyPolicyPage,
});

function PrivacyPolicyPage() {
	return (
		<div className="container-app py-12">
			<div className="mx-auto max-w-3xl">
				<h1 className="mb-2 text-display-1">Privacy Policy</h1>
				<p className="mb-10 text-(--foreground-muted) text-sm">
					Last updated: May 2026
				</p>

				<div className="prose-content space-y-8 text-(--foreground-muted)">
					<section className="space-y-3">
						<h2 className="text-(--foreground) text-display-3">Overview</h2>
						<p>
							Opnshelf is a personal media tracker built on the AT Protocol. We
							take your privacy seriously. This policy explains what data we
							collect, why we collect it, and how we use it.
						</p>
					</section>

					<section className="space-y-3">
						<h2 className="text-(--foreground) text-display-3">
							1. Information We Collect
						</h2>

						<h3 className="font-semibold text-(--foreground)">
							From your AT Protocol account
						</h3>
						<p>
							When you sign in, we read your public AT Protocol profile
							information, including your handle, display name, and avatar. We
							do not store your password — authentication is handled entirely by
							your AT Protocol identity provider (e.g., Bluesky).
						</p>

						<h3 className="font-semibold text-(--foreground)">
							Content you create
						</h3>
						<p>We store the following data that you actively provide:</p>
						<ul className="ml-6 list-disc space-y-1">
							<li>Your media shelf (movies and TV show episodes you track)</li>
							<li>Watch history, including dates watched</li>
							<li>Star ratings you submit</li>
							<li>Notes and reviews you write</li>
							<li>Lists you create</li>
							<li>Follow relationships (who you follow and who follows you)</li>
						</ul>

						<h3 className="font-semibold text-(--foreground)">
							Automatically collected data
						</h3>
						<p>
							We collect standard server logs (IP address, browser user agent,
							pages visited) to operate and improve the Service. These logs are
							not sold or shared with third parties.
						</p>
					</section>

					<section className="space-y-3">
						<h2 className="text-(--foreground) text-display-3">
							2. How We Use Your Information
						</h2>
						<ul className="ml-6 list-disc space-y-1">
							<li>To provide and personalise the Service</li>
							<li>
								To show your activity to users you follow (based on your privacy
								settings)
							</li>
							<li>To generate aggregate statistics (e.g., popular titles)</li>
							<li>To respond to feedback you send us</li>
							<li>
								To diagnose bugs and improve performance using server logs
							</li>
						</ul>
						<p>We do not sell your data to third parties.</p>
					</section>

					<section className="space-y-3">
						<h2 className="text-(--foreground) text-display-3">
							3. Third-Party Services
						</h2>
						<p>We rely on the following third-party services:</p>
						<ul className="ml-6 list-disc space-y-1">
							<li>
								<strong className="text-(--foreground)">
									The Movie Database (TMDB)
								</strong>{" "}
								— for movie and TV metadata. Poster images and descriptions are
								served from TMDB's CDN. See{" "}
								<a
									href="https://www.themoviedb.org/privacy-policy"
									target="_blank"
									rel="noopener noreferrer"
									className="text-(--accent) hover:underline"
								>
									TMDB's privacy policy
								</a>
								.
							</li>
							<li>
								<strong className="text-(--foreground)">AT Protocol</strong> —
								for decentralised identity and authentication. See{" "}
								<a
									href="https://atproto.com"
									target="_blank"
									rel="noopener noreferrer"
									className="text-(--accent) hover:underline"
								>
									atproto.com
								</a>
								.
							</li>
						</ul>
					</section>

					<section className="space-y-3">
						<h2 className="text-(--foreground) text-display-3">
							4. Data Retention
						</h2>
						<p>
							Your data is retained for as long as your account is active. You
							can request deletion of your account and associated data by
							contacting us.
						</p>
					</section>

					<section className="space-y-3">
						<h2 className="text-(--foreground) text-display-3">
							5. Your Rights
						</h2>
						<p>
							Depending on your location, you may have rights including access,
							correction, and deletion of your personal data. To exercise these
							rights, please contact us via{" "}
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

					<section className="space-y-3">
						<h2 className="text-(--foreground) text-display-3">
							6. Cookies and Local Storage
						</h2>
						<p>
							We use browser local storage to save your theme preference and
							authentication session. We do not use third-party tracking cookies
							or advertising cookies.
						</p>
					</section>

					<section className="space-y-3">
						<h2 className="text-(--foreground) text-display-3">7. Changes</h2>
						<p>
							We may update this Privacy Policy from time to time. Continued use
							of the Service after changes constitutes acceptance of the updated
							policy.
						</p>
					</section>

					<section className="space-y-3">
						<h2 className="text-(--foreground) text-display-3">8. Contact</h2>
						<p>
							For privacy-related questions, please reach out via{" "}
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
					<Link to="/tos" className="text-(--accent) text-sm hover:underline">
						Read our Terms of Service →
					</Link>
				</div>
			</div>
		</div>
	);
}
