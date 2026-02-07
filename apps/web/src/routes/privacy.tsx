import { createFileRoute, Link } from "@tanstack/react-router";
import { Shield } from "lucide-react";

export const Route = createFileRoute("/privacy")({
	head: () => ({
		meta: [{ title: "Privacy Policy - OpnShelf" }],
	}),
	component: PrivacyPage,
});

function PrivacyPage() {
	return (
		<div className="min-h-screen bg-gray-950 text-gray-50">
			<div className="container mx-auto px-4 py-16 max-w-4xl">
				<div className="text-center mb-12">
					<div className="flex justify-center mb-6">
						<Shield className="w-16 h-16 text-purple-500" />
					</div>
					<h1 className="text-4xl font-bold mb-4">Privacy Policy</h1>
					<p className="text-gray-400">
						Last updated: {new Date().toLocaleDateString()}
					</p>
				</div>

				<div className="space-y-8 text-gray-300">
					<section>
						<h2 className="text-2xl font-semibold text-white mb-4">
							1. Information We Collect
						</h2>
						<p className="mb-4">
							When you use OpnShelf, we collect the following types of
							information:
						</p>
						<ul className="list-disc list-inside space-y-2 ml-4">
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
						<h2 className="text-2xl font-semibold text-white mb-4">
							2. How We Use Your Information
						</h2>
						<p className="mb-4">We use your information to:</p>
						<ul className="list-disc list-inside space-y-2 ml-4">
							<li>Provide and maintain our media tracking service</li>
							<li>Sync your data across devices via AT Protocol</li>
							<li>Improve our service and user experience</li>
							<li>Communicate with you about service updates</li>
						</ul>
					</section>

					<section>
						<h2 className="text-2xl font-semibold text-white mb-4">
							3. Data Storage and AT Protocol
						</h2>
						<p className="mb-4">
							OpnShelf is built on the AT Protocol (Authenticated Transfer
							Protocol). This means:
						</p>
						<ul className="list-disc list-inside space-y-2 ml-4">
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
						<h2 className="text-2xl font-semibold text-white mb-4">
							4. Data Sharing
						</h2>
						<p>
							We do not sell or rent your personal information. We may share
							data only in the following circumstances:
						</p>
						<ul className="list-disc list-inside space-y-2 ml-4 mt-4">
							<li>With your consent (e.g., sharing your shelf publicly)</li>
							<li>To comply with legal obligations</li>
							<li>To protect our rights or prevent fraud</li>
						</ul>
					</section>

					<section>
						<h2 className="text-2xl font-semibold text-white mb-4">
							5. Cookies and Tracking
						</h2>
						<p>
							We use essential cookies to maintain your session and authenticate
							you. We do not use tracking cookies for advertising purposes.
						</p>
					</section>

					<section>
						<h2 className="text-2xl font-semibold text-white mb-4">
							6. Your Rights
						</h2>
						<p className="mb-4">You have the right to:</p>
						<ul className="list-disc list-inside space-y-2 ml-4">
							<li>Access your personal data</li>
							<li>Correct inaccurate data</li>
							<li>Delete your data</li>
							<li>Export your data</li>
							<li>Opt out of non-essential communications</li>
						</ul>
					</section>

					<section>
						<h2 className="text-2xl font-semibold text-white mb-4">
							7. Security
						</h2>
						<p>
							We implement appropriate technical and organizational measures to
							protect your data. However, no internet transmission is completely
							secure, and we cannot guarantee absolute security.
						</p>
					</section>

					<section>
						<h2 className="text-2xl font-semibold text-white mb-4">
							8. Changes to This Policy
						</h2>
						<p>
							We may update this privacy policy from time to time. We will
							notify you of any changes by posting the new policy on this page
							and updating the "Last updated" date.
						</p>
					</section>

					<section>
						<h2 className="text-2xl font-semibold text-white mb-4">
							9. Contact Us
						</h2>
						<p>
							If you have any questions about this privacy policy, please
							contact us through our GitHub repository or AT Protocol handle.
						</p>
					</section>
				</div>

				<div className="mt-12 pt-8 border-t border-gray-800 text-center">
					<Link
						to="/"
						className="inline-flex items-center gap-2 text-purple-400 hover:text-purple-300 transition-colors"
					>
						← Back to Home
					</Link>
				</div>
			</div>
		</div>
	);
}
