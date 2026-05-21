#!/usr/bin/env node
/**
 * Standalone screenshot capture script.
 *
 * Prerequisites:
 *   1. Dev server running on 127.0.0.1:3000
 *   2. Playwright browsers installed:
 *        pnpm dlx playwright install chromium
 *      (or: npx playwright install chromium)
 *
 * Usage:
 *   node apps/web/scripts/capture-screenshots.cjs
 *
 * The script opens a browser window, waits for you to log in,
 * then captures screenshots to apps/web/public/screenshots/
 */

const { execSync } = require("child_process");
const path = require("path");

// Resolve playwright from the temp install we created earlier, or install on the fly
function resolvePlaywright() {
	try {
		return require("playwright");
	} catch {
		// Try the temp install directory from the earlier session
		const tempDir =
			"/private/var/folders/z9/1gjyy6gd2pdc483kl0hm1vqr0000gn/T/opencode/playwright-screenshots/node_modules";
		try {
			process.env.NODE_PATH = tempDir;
			require("module").Module._initPaths();
			return require("playwright");
		} catch {
			console.error(
				"Playwright module not found. Installing temporarily...",
			);
			const tmp = require("os").tmpdir();
			const installDir = path.join(tmp, "opnshelf-playwright-" + Date.now());
			require("fs").mkdirSync(installDir, { recursive: true });
			execSync("npm install playwright@^1.60.0", {
				cwd: installDir,
				stdio: "inherit",
			});
			process.env.NODE_PATH = path.join(installDir, "node_modules");
			require("module").Module._initPaths();
			return require("playwright");
		}
	}
}

(async () => {
	const { chromium } = await resolvePlaywright();

	const OUT_DIR = path.join(__dirname, "../public/screenshots");
	require("fs").mkdirSync(OUT_DIR, { recursive: true });

	const browser = await chromium.launch({ headless: false });
	const context = await browser.newContext({
		viewport: { width: 1920, height: 1080 },
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
			(url) =>
				!url.pathname.includes("/login") && !url.pathname.includes("/oauth"),
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
		{ url: "http://127.0.0.1:3000/dashboard", name: "dashboard", wait: 3000 },
		{ url: "http://127.0.0.1:3000/search?q=interstellar", name: "search", wait: 3000 },
		{
			url: "http://127.0.0.1:3000/movies/157336/interstellar",
			name: "media-detail",
			wait: 3000,
		},
	];

	for (const route of routes) {
		await page.goto(route.url, { waitUntil: "domcontentloaded" });
		await page.waitForTimeout(route.wait);
		await page.screenshot({
			path: path.join(OUT_DIR, `${route.name}.png`),
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
		await page.goto(`http://127.0.0.1:3000/profile/${userHandle}`, {
			waitUntil: "domcontentloaded",
		});
	} else {
		console.log("  ⚠️  Could not detect user handle, using fallback.");
		await page.goto("http://127.0.0.1:3000/profile/rowanpaul.opnshelf.social", {
			waitUntil: "domcontentloaded",
		});
	}
	await page.waitForTimeout(3000);
	await page.screenshot({
		path: path.join(OUT_DIR, "profile.png"),
		fullPage: false,
	});
	console.log("  ✅ profile.png captured");

	await browser.close();

	console.log("\n========================================");
	console.log("  All screenshots saved to:");
	console.log(`  ${OUT_DIR}`);
	console.log("========================================\n");
})();
