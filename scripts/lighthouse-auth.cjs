const { webOrigin, apiOrigin } = require("./lighthouse-pages.cjs");

module.exports = async (browser) => {
	await browser.defaultBrowserContext().setCookie(
		{
			name: "opnshelf_session",
			value: "lighthouse-fixture-only",
			url: apiOrigin,
			httpOnly: true,
			sameSite: "Lax",
		},
		{
			name: "opnshelf_signed_in",
			value: "1",
			url: webOrigin,
			sameSite: "Lax",
		},
	);
};
