// Production-bundled renderer in Chromium. A local regression budget, not a
// guarantee for every device. Run: node scripts/confetti-performance.mjs
import assert from "node:assert/strict";
import puppeteer from "puppeteer";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { resolve } from "node:path";
const require = createRequire(import.meta.url);
const { build } = await import(
	require.resolve("vite", { paths: [resolve("apps/web")] })
);
const bundle = await build({
	configFile: false,
	logLevel: "error",
	define: { "process.env.NODE_ENV": JSON.stringify("production") },
	resolve: { alias: { "#": resolve("apps/web/src") } },
	build: {
		write: false,
		lib: {
			entry: resolve("apps/web/src/components/completion-confetti.ts"),
			formats: ["es"],
			fileName: "confetti",
		},
	},
});
const code = (Array.isArray(bundle) ? bundle[0] : bundle).output.find(
	(item) => item.type === "chunk",
).code;
const server = createServer((request, response) => {
	response.setHeader(
		"content-type",
		request.url === "/confetti.js" ? "text/javascript" : "text/html",
	);
	response.end(
		request.url === "/confetti.js"
			? code
			: '<!doctype html><body style="background:#202020">Confetti performance fixture</body>',
	);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

const browser = await puppeteer.launch({ headless: true });
try {
	const page = await browser.newPage();
	await page.bringToFront();
	await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
	await page.goto(`http://127.0.0.1:${server.address().port}`, {
		waitUntil: "load",
	});

	const session = await page.createCDPSession();
	await session.send("Emulation.setCPUThrottlingRate", { rate: 4 });
	const result = await page.evaluate(async () => {
		const { celebrateCompletion } = await import("/confetti.js");

		const longTasks = [];
		const observer = new PerformanceObserver((list) =>
			longTasks.push(...list.getEntries().map((e) => e.duration)),
		);
		observer.observe({ type: "longtask", buffered: false });
		const intervals = [];
		let last;
		let running = true;
		function frame(now) {
			if (last !== undefined) intervals.push(now - last);
			last = now;
			if (running) requestAnimationFrame(frame);
		}
		requestAnimationFrame(frame);
		await new Promise((resolve) => setTimeout(resolve, 100));
		const start = performance.now();
		celebrateCompletion();

		const setupMs = performance.now() - start;
		for (let i = 0; i < 100; i++) celebrateCompletion();
		const particles = document.querySelectorAll(
			"[data-completion-confetti] span",
		).length;
		const overlays = document.querySelectorAll(
			"[data-completion-confetti]",
		).length;
		await new Promise((resolve) => setTimeout(resolve, 3900));
		running = false;
		observer.disconnect();
		intervals.sort((a, b) => a - b);
		return {
			setupMs,
			particles,
			overlays,
			frames: intervals.length,
			p95FrameMs: intervals[Math.floor(intervals.length * 0.95)],
			maxFrameMs: Math.max(...intervals),
			longTasks,
			remainingOverlays: document.querySelectorAll("[data-completion-confetti]")
				.length,
		};
	});
	console.log(
		JSON.stringify(
			{
				browser: await browser.version(),
				viewport: "1280x800",
				cpuSlowdown: 4,
				...result,
			},
			null,
			2,
		),
	);
	assert.equal(result.overlays, 1);
	assert.equal(result.particles, 64);
	assert.equal(result.remainingOverlays, 0);
	assert.ok(
		result.setupMs < 50,
		"Burst setup exceeded 50ms at 4x CPU slowdown",
	);
	if (result.frames > 0)
		assert.ok(result.p95FrameMs < 34, "95th percentile exceeded 34ms");
	else
		console.warn(
			"Frame timing unavailable in this headless environment; no FPS claim.",
		);
} finally {
	await browser.close();
	await new Promise((resolve) => server.close(resolve));
}
