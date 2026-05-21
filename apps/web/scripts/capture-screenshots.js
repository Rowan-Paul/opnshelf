/**
 * Standalone Playwright script to capture authenticated screenshots.
 *
 * Usage:
 *   1. Make sure your dev server is running (127.0.0.1:3000)
 *   2. Install playwright browsers if you haven't:
 *      npx playwright install chromium
 *   3. Run this script in your own terminal (so you can interact with the
 *      browser window while it waits for you to log in):
 *      node apps/web/scripts/capture-screenshots.js
 *   4. Log in via the opened browser window.
 *   5. The script auto-detects when you leave the login page and captures
 *      screenshots to apps/web/public/screenshots/
 */

const { chromium } = require("playwright");

const OUT_DIR = `${__dirname}/../public/screenshots`;

(async () => {
	const browser = await chromium.launch({ headless: false });
	const context = await browser.newContext({
		viewport: { width: 1440, height: 900 },
	});
	const page = await context.newPage();

	await page.goto("http://127.0.0.1:3000/login");

	console.log("\n========================================");
	console.log("  A browser window has opened.");
	console.log("  Please log in to OpnShelf.");
	console.log("  The script will auto-detect login.");
	console.log("========================================\n");

	try {
		await page.waitForURL(
			(url) => !url.pathname.includes("/login") && !url.pathname.includes("/oauth"),
			{ timeout: 300000 },
		);
		console.log(`  Detected post-login URL: ${page.url()}`);
	} catch (e) {
		console.error("  Timed out waiting for login.");
		await browser.close();
		process.exit(1);
	}

	await page.waitForTimeout(2000);
	console.log("  Capturing screenshots...\n");

	const routes = [
		{ url: "http://127.0.0.1:3000/dashboard", name: "dashboard", wait: 1500 },
		{ url: "http://127.0.0.1:3000/search", name: "search", wait: 2000 },
		{
			url: "http://127.0.0.1:3000/movies/157336/interstellar",
			name: "media-detail",
			wait: 1500,
		},
	];

	for (const route of routes) {
		await page.goto(route.url);
		await page.waitForLoadState("networkidle");
		await page.waitForTimeout(route.wait);
		await page.screenshot({
			path: `${OUT_DIR}/${route.name}.png`,
			fullPage: false,
		});
		console.log(`  ✅ ${route.name}.png captured`);
	}

	// Profile — try to detect user's handle from localStorage
	const userHandle = await page.evaluate(() => {
		const keys = ["user", "auth_user", "opnshelf_user", "opnshelf:auth:user"];
		for (const k of keys) {
			const v = localStorage.getItem(k);
			if (v) {
				try {
					const parsed = JSON.parse(v);
					if (parsed.handle) return parsed.handle;
					if (parsed.profile?.handle) return parsed.profile.handle;
				} catch {}
			}
		}
		return null;
	});

	if (userHandle) {
		await page.goto(`http://127.0.0.1:3000/profile/${userHandle}`);
	} else {
		console.log("  ⚠️  Could not detect user handle, using fallback.");
		await page.goto("http://127.0.0.1:3000/profile/test.handle");
	}
	await page.waitForLoadState("networkidle");
	await page.waitForTimeout(1500);
	await page.screenshot({ path: `${OUT_DIR}/profile.png`, fullPage: false });
	console.log("  ✅ profile.png captured");

	await browser.close();

	console.log("\n========================================");
	console.log("  All screenshots saved to:");
	console.log(`  ${OUT_DIR}`);
	console.log("========================================\n");
})();
