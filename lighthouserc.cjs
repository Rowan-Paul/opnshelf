const { webOrigin, pages } = require("./scripts/lighthouse-pages.cjs");

module.exports = {
	ci: {
		collect: {
			url: pages.map((page) => webOrigin + page.path),
			numberOfRuns: 3,
			puppeteerScript: "scripts/lighthouse-auth.cjs",
			puppeteerLaunchOptions: {
				args: ["--no-sandbox", "--disable-dev-shm-usage"],
			},
			settings: {
				configPath: "./scripts/lighthouse-audits.mjs",
				formFactor: "mobile",
				screenEmulation: {
					mobile: true,
					width: 390,
					height: 844,
					deviceScaleFactor: 1,
					disabled: false,
				},
			},
		},
		upload: {
			target: "lhci",
			serverBaseUrl: process.env.LHCI_SERVER_URL,
			token: process.env.LHCI_BUILD_TOKEN,
			basicAuth: {
				username: process.env.LHCI_BASIC_AUTH_USERNAME || "opnshelf",
				password: process.env.LHCI_BASIC_AUTH_PASSWORD,
			},
			ignoreDuplicateBuildFailure: true,
		},
		// Only audit validity blocks CI. Performance/a11y scores establish a baseline.
		assert: {
			assertions: {
				"authenticated-content": [
					"error",
					{ minScore: 1, aggregationMethod: "pessimistic" },
				],
			},
		},
	},
};
