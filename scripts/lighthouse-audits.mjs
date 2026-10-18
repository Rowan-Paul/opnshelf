import { createRequire } from "node:module";
import { checkContent } from "./lighthouse-pages.cjs";

// Use the same Lighthouse version that the pinned LHCI CLI runs.
const require = createRequire(
	createRequire(import.meta.url).resolve("@lhci/cli/package.json"),
);
const { default: BaseGatherer } = await import(
	require.resolve("lighthouse/core/gather/base-gatherer.js")
);
const { Audit } = await import(
	require.resolve("lighthouse/core/audits/audit.js")
);

class SignedInContent extends BaseGatherer {
	meta = { supportedModes: ["navigation"] };
	async getArtifact({ driver }) {
		// Read the measured page after navigation, rather than warming it with a preflight visit.
		return driver.executionContext.evaluate(
			() => ({
				url: location.href,
				text: document.body.innerText,
				ownProfile: Boolean(
					document.querySelector('a[href="/profile/synthetic.test"]'),
				),
			}),
			{ args: [], useIsolation: true },
		);
	}
}

export class AuthenticatedContent extends Audit {
	static get meta() {
		return {
			id: "authenticated-content",
			title: "Expected signed-in content rendered",
			failureTitle: "Expected signed-in content did not render",
			description:
				"Checks the measured route and populated personal content, preventing scores for Login, error pages or skeletons.",
			requiredArtifacts: ["SignedInContent"],
		};
	}
	static audit({ SignedInContent: content }) {
		return checkContent(content);
	}
}

export default {
	extends: "lighthouse:default",
	artifacts: [
		{ id: "SignedInContent", gatherer: { instance: new SignedInContent() } },
	],
	audits: [{ implementation: AuthenticatedContent }],
	categories: {
		opnshelf: {
			title: "Authenticated content",
			description: "Audit validity",
			auditRefs: [{ id: "authenticated-content", weight: 1 }],
		},
	},
};
