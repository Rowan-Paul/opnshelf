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
							Most Opnshelf accounts are created on Opnshelf's own PDS (personal
							data server), so Opnshelf hosts your AT Protocol account and
							authenticates it. If you instead sign in with a handle you already
							own, such as a Bluesky handle, your existing provider
							authenticates you.
						</p>
						<p>
							When you sign in, we read your public AT Protocol profile
							information, including your handle, display name, and avatar.
						</p>
						<p>
							Signing up with a password asks for a username, an email address
							and a password. We pass the email address and the password to the
							PDS and store neither. Our own database keeps your handle and
							whether the email has been confirmed. Signing up with Google gives
							us the email address on your Google account, which we hand to the
							PDS the same way.
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
						<p>
							On the live site we also use PostHog to measure how the Service is
							used: which features people use, how pages perform, and when a
							visit ends. Analytics runs only on opnshelf.xyz and the data is
							processed in the European Union. We strip the page address and the
							referring page out of every event, because our addresses can
							contain things you typed. Once you sign in, these events are
							linked to your account identifier.
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
								for movie and TV metadata. Poster images and descriptions are
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
								<strong className="text-(--foreground)">AT Protocol</strong> for
								decentralised identity. Opnshelf runs its own PDS and hosts the
								accounts it creates there. Public profile data, such as display
								names and avatars, is read from Bluesky's public API. See{" "}
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
							<li>
								<strong className="text-(--foreground)">Google</strong>, if you
								choose to sign up or sign in with Google. Google tells our PDS
								your email address and whether it is verified. See{" "}
								<a
									href="https://policies.google.com/privacy"
									target="_blank"
									rel="noopener noreferrer"
									className="text-(--accent) hover:underline"
								>
									Google's privacy policy
								</a>
								.
							</li>
							<li>
								<strong className="text-(--foreground)">Cloudflare</strong> for
								the signup captcha (Turnstile) and for sending account email,
								such as your verification code. See{" "}
								<a
									href="https://www.cloudflare.com/privacypolicy/"
									target="_blank"
									rel="noopener noreferrer"
									className="text-(--accent) hover:underline"
								>
									Cloudflare's privacy policy
								</a>
								.
							</li>
							<li>
								<strong className="text-(--foreground)">PostHog</strong> for
								product analytics on the live site, processed in the European
								Union. See{" "}
								<a
									href="https://posthog.com/privacy"
									target="_blank"
									rel="noopener noreferrer"
									className="text-(--accent) hover:underline"
								>
									PostHog's privacy policy
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
							can delete your account yourself in Settings, which removes your
							Opnshelf data. You can choose to delete the records Opnshelf saved
							to your PDS at the same time.
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
							We keep you signed in with a session cookie. The cookie is
							httpOnly, so only our API can read it. We use browser local
							storage for your theme preference, for a random id that labels
							this browser on your devices list, and to remember which prompts
							you have dismissed on this browser. On the live site, analytics
							sets a first-party cookie that recognises this browser between
							visits. We do not use third-party tracking cookies or advertising
							cookies.
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
