// Browser assertions against a running `pnpm dev:scenarios web` stack. They
// check what a screenshot only shows: one unread indicator per breakpoint, in
// its trigger's top-right corner, and no menu left mounted after a resize hides
// its trigger. Run: pnpm dev:scenarios:check [SCENARIO] [--capture before|after]
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { leaseRoot, root } from "./dev-session.mjs";

export const webBase = "http://127.0.0.1:3390";
export const controller = "http://127.0.0.1:3391/__scenario";
export const desktopBreakpoint = 768;
// Fixed sizes, so a before and an after screenshot always compare like for like.
export const viewports = {
	phone: { width: 390, height: 844 },
	tablet: { width: 700, height: 1024 },
	desktop: { width: 1280, height: 800 },
};

/** The control that carries the unread indicator at this width. */
export function expectedTrigger(width) {
	return width >= desktopBreakpoint ? "User menu" : "Open menu";
}

/**
 * The dot must touch the trigger's top-right corner. Returns a failure message,
 * or null. Rects are DOMRect-like: { top, right, bottom, left }.
 */
export function topRightFailure(dot, trigger, tolerance = 3) {
	const dx = trigger.right - dot.right;
	const dy = dot.top - trigger.top;
	if (Math.abs(dx) <= tolerance && Math.abs(dy) <= tolerance) return null;
	return `dot is ${dx.toFixed(1)} px left of and ${dy.toFixed(1)} px below the trigger's top-right corner (tolerance ${tolerance} px)`;
}

export function screenshotName(scenario, viewport, label) {
	if (!["before", "after"].includes(label))
		throw new Error("Screenshot label must be before or after");
	if (!viewports[viewport]) throw new Error(`Unknown viewport ${viewport}`);
	return `${scenario}-${viewport}-${label}.png`;
}

export function pngSize(buffer) {
	if (buffer.toString("ascii", 1, 4) !== "PNG") throw new Error("Not a PNG");
	return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

/** Pairs `<scenario>-<viewport>-before|after.png` and flags size mismatches. */
export function comparePairs(directory) {
	const files = existsSync(directory) ? readdirSync(directory) : [];
	const pairs = [];
	for (const file of files) {
		const match = /^(.+)-before\.png$/.exec(file);
		if (!match || !files.includes(`${match[1]}-after.png`)) continue;
		const [before, after] = ["before", "after"].map((label) =>
			pngSize(readFileSync(join(directory, `${match[1]}-${label}.png`))),
		);
		pairs.push({
			name: match[1],
			before,
			after,
			matches: before.width === after.width && before.height === after.height,
		});
	}
	return pairs;
}

function parseArgs(args) {
	let scenario = "issue-fixes";
	let capture = null;
	let out = join(root, ".ui-checks");
	for (let index = 0; index < args.length; index++) {
		if (args[index] === "--capture") capture = args[++index];
		else if (args[index] === "--out") out = resolve(args[++index]);
		else scenario = args[index];
	}
	if (capture && !["before", "after"].includes(capture))
		throw new Error("Use --capture before or --capture after");
	return { scenario, capture, out };
}

function assertOwnStack() {
	const path = join(
		leaseRoot,
		createHash("sha256").update("stack:ui-scenarios").digest("hex"),
		"owner.json",
	);
	if (!existsSync(path))
		throw new Error("No UI scenario stack is running. Start: pnpm dev:scenarios web");
	const { worktree } = JSON.parse(readFileSync(path, "utf8"));
	if (worktree !== root)
		throw new Error(
			`The UI scenario stack serves ${worktree}, not this worktree. See pnpm dev:status.`,
		);
}

async function main() {
	const { scenario, capture, out } = parseArgs(process.argv.slice(2));
	assertOwnStack();
	const reset = await fetch(controller, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ scenario }),
	});
	if (!reset.ok) throw new Error(`Scenario reset failed: ${reset.status}`);
	if (capture) mkdirSync(out, { recursive: true });

	const { default: puppeteer } = await import("puppeteer");
	const browser = await puppeteer.launch({ headless: true });
	const failures = [];
	const check = (name, failure) => {
		console.log(`${failure ? "FAIL" : "ok  "} ${name}${failure ? `: ${failure}` : ""}`);
		if (failure) failures.push(name);
	};
	try {
		const page = await browser.newPage();
		const open = async (viewport) => {
			await page.setViewport({ ...viewports[viewport], deviceScaleFactor: 1 });
			// Release Notes poll every minute, so the network never goes idle for good.
			await page.goto(`${webBase}/`, { waitUntil: "load", timeout: 90_000 });
			await page.waitForFunction(
				() =>
					[...document.querySelectorAll('header [aria-label="Unread release notes"]')].some(
						(dot) => dot.checkVisibility(),
					),
				{ timeout: 30_000 },
			);
			await page.waitForNetworkIdle({ idleTime: 500, timeout: 5_000 }).catch(() => {});
		};

		for (const viewport of Object.keys(viewports)) {
			await open(viewport);
			if (capture) {
				const file = join(out, screenshotName(scenario, viewport, capture));
				await page.screenshot({ path: file });
				console.log(`     saved ${file}`);
			}
			const dots = await page.evaluate(() =>
				[...document.querySelectorAll('header [aria-label="Unread release notes"]')]
					.filter(
						(dot) =>
							dot.checkVisibility({ visibilityProperty: true, opacityProperty: true }) &&
							dot.getBoundingClientRect().width > 0,
					)
					.map((dot) => {
						const trigger = dot.closest("button");
						const box = (element) => {
							const { top, right, bottom, left } = element.getBoundingClientRect();
							return { top, right, bottom, left };
						};
						return {
							dot: box(dot),
							label: trigger?.getAttribute("aria-label") ?? "",
							trigger: trigger ? box(trigger) : null,
						};
					}),
			);
			const expected = expectedTrigger(viewports[viewport].width);
			check(
				`${viewport}: exactly one visible unread indicator`,
				dots.length === 1 ? null : `found ${dots.length} (${dots.map((d) => d.label || "no trigger").join("; ")})`,
			);
			const [dot] = dots;
			if (!dot) continue;
			check(
				`${viewport}: indicator sits on the ${expected} trigger`,
				dot.label.startsWith(expected) ? null : `sits on "${dot.label}"`,
			);
			if (dot.trigger)
				check(
					`${viewport}: indicator in the trigger's top-right corner`,
					topRightFailure(dot.dot, dot.trigger),
				);
		}

		const orphan = async (name, from, to, trigger, menu) => {
			await open(from);
			await page.click(trigger);
			await page.waitForSelector(menu, { visible: true, timeout: 10_000 });
			await page.setViewport({ ...viewports[to], deviceScaleFactor: 1 });
			const gone = await page
				.waitForFunction((selector) => !document.querySelector(selector), { timeout: 2_000 }, menu)
				.then(() => true, () => false);
			check(name, gone ? null : `${menu} is still mounted after its trigger was hidden`);
		};
		await orphan(
			"desktop to phone: avatar dropdown unmounts",
			"desktop",
			"phone",
			'header button[aria-label^="User menu"]',
			'[role="menu"]',
		);
		await orphan(
			"phone to desktop: compact navigation unmounts",
			"phone",
			"desktop",
			'header button[aria-controls="mobile-navigation"]',
			"#mobile-navigation",
		);
	} finally {
		await browser.close();
	}

	for (const pair of comparePairs(out).filter((p) => p.name.startsWith(`${scenario}-`)))
		check(
			`${pair.name}: before and after share a viewport size`,
			pair.matches ? null : `${pair.before.width}x${pair.before.height} vs ${pair.after.width}x${pair.after.height}`,
		);
	if (failures.length) {
		console.error(`${failures.length} UI check(s) failed`);
		process.exitCode = 1;
	}
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
	main().catch((error) => {
		console.error(error.message);
		process.exitCode = 1;
	});
