import { createFileRoute, Link } from "@tanstack/react-router";
import { Shield } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

export const Route = createFileRoute("/privacy")({
	head: () => ({
		meta: [{ title: "Privacy Policy - OpnShelf" }],
	}),
	component: PrivacyPage,
});

function PrivacyPage() {
	const { seedColor } = useTheme();

	return (
		<div
			className="min-h-screen"
			style={{
				backgroundColor: "var(--md-sys-color-background)",
				color: "var(--md-sys-color-on-background)",
			}}
		>
			<div className="container mx-auto px-4 py-16 max-w-4xl">
				<div className="text-center mb-12">
					<div className="flex justify-center mb-6">
						<Shield className="w-16 h-16" style={{ color: seedColor }} />
					</div>
					<h1 className="md-display-small mb-4">Privacy Policy</h1>
					<p style={{ color: "var(--md-sys-color-on-surface-variant)" }}>
						Last updated: {new Date().toLocaleDateString()}
					</p>
				</div>

				<div
					className="space-y-8"
					style={{ color: "var(--md-sys-color-on-surface)" }}
				>
					<section>
						<h2 className="md-headline-small mb-4">
							1. Information We Collect
						</h2>
						<p className="mb-4 md-body-large">
							When you use OpnShelf, we collect the following types of
							information:
						</p>
						<ul className="list-disc list-inside space-y-2 ml-4 md-body-large">
							<li>
								<strong>Account Information:</strong> Your AT Protocol handle,
								display name, and profile information when you authenticate.
							</li>
							<li>
								<strong>Media Data:</strong> Movies and shows you add to your
								shelf, watch status, and ratings.
							</li>
							<li>
								<strong>Usage Data:</strong> How you interact with our service
								(pages visited, features used).
							</li>
						</ul>
					</section>

					<section>
						<h2 className="md-headline-small mb-4">
							2. How We Use Your Information
						</h2>
						<p className="mb-4 md-body-large">We use your information to:</p>
						<ul className="list-disc list-inside space-y-2 ml-4 md-body-large">
							<li>Provide and maintain our media tracking service</li>
							<li>Sync your data across devices via AT Protocol</li>
							<li>Improve our service and user experience</li>
							<li>Communicate with you about service updates</li>
						</ul>
					</section>

					<section>
						<h2 className="md-headline-small mb-4">
							3. Data Storage and AT Protocol
						</h2>
						<p className="mb-4 md-body-large">
							OpnShelf is built on the AT Protocol (Authenticated Transfer
							Protocol). This means:
						</p>
						<ul className="list-disc list-inside space-y-2 ml-4 md-body-large">
							<li>
								Your data is stored in your personal data repository (PDR) on
								your AT Protocol server
							</li>
							<li>You maintain ownership and control of your data</li>
							<li>
								You can export or delete your data at any time through your AT
								Protocol account
							</li>
							<li>We only access the data necessary to provide our service</li>
						</ul>
					</section>

					<section>
						<h2 className="md-headline-small mb-4">4. Data Sharing</h2>
						<p className="md-body-large">
							We do not sell or rent your personal information. We may share
							data only in the following circumstances:
						</p>
						<ul className="list-disc list-inside space-y-2 ml-4 mt-4 md-body-large">
							<li>With your consent (e.g., sharing your shelf publicly)</li>
							<li>To comply with legal obligations</li>
							<li>To protect our rights or prevent fraud</li>
						</ul>
					</section>

					<section>
						<h2 className="md-headline-small mb-4">5. Cookies and Tracking</h2>
						<p className="md-body-large">
							We use essential cookies to maintain your session and authenticate
							you. We do not use tracking cookies for advertising purposes.
						</p>
					</section>

					<section>
						<h2 className="md-headline-small mb-4">6. Your Rights</h2>
						<p className="mb-4 md-body-large">You have the right to:</p>
						<ul className="list-disc list-inside space-y-2 ml-4 md-body-large">
							<li>Access your personal data</li>
							<li>Correct inaccurate data</li>
							<li>Delete your data</li>
							<li>Export your data</li>
							<li>Opt out of non-essential communications</li>
						</ul>
					</section>

					<section>
						<h2 className="md-headline-small mb-4">7. Security</h2>
						<p className="md-body-large">
							We implement appropriate technical and organizational measures to
							protect your data. However, no internet transmission is completely
							secure, and we cannot guarantee absolute security.
						</p>
					</section>

					<section>
						<h2 className="md-headline-small mb-4">
							8. Changes to This Policy
						</h2>
						<p className="md-body-large">
							We may update this privacy policy from time to time. We will
							notify you of any changes by posting the new policy on this page
							and updating the "Last updated" date.
						</p>
					</section>

					<section>
						<h2 className="md-headline-small mb-4">9. Contact Us</h2>
						<p className="md-body-large">
							If you have any questions about this privacy policy, please
							contact us through our GitHub repository or AT Protocol handle.
						</p>
					</section>
				</div>

				<div
					className="mt-12 pt-8 text-center"
					style={{ borderTop: "1px solid var(--md-sys-color-outline-variant)" }}
				>
					<Link
						to="/"
						className="inline-flex items-center gap-2 transition-colors md-label-large"
						style={{ color: seedColor }}
						onMouseEnter={(e) => {
							e.currentTarget.style.opacity = "0.8";
						}}
						onMouseLeave={(e) => {
							e.currentTarget.style.opacity = "1";
						}}
					>
						← Back to Home
					</Link>
				</div>
			</div>
		</div>
	);
}
