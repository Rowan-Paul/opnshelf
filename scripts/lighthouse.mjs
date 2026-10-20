import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import {
	mkdirSync,
	readFileSync,
	readdirSync,
	writeFileSync,
	appendFileSync,
} from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createLighthouseServer } from "./lighthouse-fixtures.mjs";
import { pages, webOrigin, apiOrigin } from "./lighthouse-pages.cjs";
import dashboard from "../services/lighthouse/package.json" with { type: "json" };
import {
	root,
	owner,
	claim,
	release,
	processIdentity,
} from "./dev-session.mjs";

export function validateReport(report) {
	assert(!report.runtimeError, report.runtimeError?.message);
	assert.equal(
		report.lighthouseVersion,
		dashboard.overrides.lighthouse,
		"Report Lighthouse version must match the dashboard renderer",
	);
	const page = pages.find(
		(page) => webOrigin + page.path === report.requestedUrl,
	);
	assert(page, `Unexpected report URL: ${report.requestedUrl}`);
	assert.equal(
		report.finalDisplayedUrl ?? report.finalUrl,
		report.requestedUrl,
		"Audited page redirected",
	);
	assert.equal(
		report.audits["authenticated-content"]?.score,
		1,
		report.audits["authenticated-content"]?.explanation ||
			"Signed-in content audit missing",
	);
	const requests = report.audits["network-requests"].details.items;
	assert(
		requests.some(
			(request) =>
				request.url === `${apiOrigin}/auth/me` && request.statusCode === 200,
		),
		"Measured navigation did not authenticate",
	);
	for (const path of page.api) {
		assert(
			requests.some(
				(request) =>
					decodeURIComponent(request.url).startsWith(apiOrigin + path) &&
					request.statusCode === 200,
			),
			`Missing measured API read: ${path}`,
		);
	}
	const failed = requests.filter(
		(request) => request.url.startsWith(apiOrigin) && request.statusCode >= 400,
	);
	assert.equal(
		failed.length,
		0,
		`Failed API reads: ${failed.map((request) => request.url).join(", ")}`,
	);
	return page;
}

async function run() {
	const runs = Number(process.env.LHCI_RUNS || 3);
	assert(
		Number.isInteger(runs) && runs > 0 && runs <= 10,
		"LHCI_RUNS must be an integer from 1 to 10",
	);
	const children = new Set();
	const { server, errors } = createLighthouseServer();
	let claimed = false;
	const env = {
		...process.env,
		VITE_API_URL: apiOrigin,
		VITE_SITE_URL: webOrigin,
		SERVER_URL: "http://127.0.0.1:3391",
		SSR_RATE_LIMIT_SECRET: "",
		VITE_POSTHOG_KEY: "",
		VITE_TURNSTILE_SITE_KEY: "",
		NODE_ENV: "production",
		PORT: "3390",
		HOST: "127.0.0.1",
	};
	mkdirSync(".lighthouseci", { recursive: true });
	function start(command, args, log) {
		const child = spawn(command, args, {
			cwd: root,
			env,
			detached: true,
			stdio: log ? ["ignore", "pipe", "pipe"] : "inherit",
		});
		children.add(child);
		if (log)
			for (const stream of [child.stdout, child.stderr])
				stream.on("data", (data) => appendFileSync(log, data));
		child.done = new Promise((resolve, reject) => {
			child.once("error", reject);
			child.once("exit", (code, signal) => {
				children.delete(child);
				code === 0
					? resolve()
					: reject(
							new Error(
								`${command} ${args.join(" ")} exited ${code ?? signal}`,
							),
						);
			});
		});
		// Long-lived servers are checked during readiness and stopped in finally.
		child.done.catch(() => {});
		return child;
	}
	async function cleanup() {
		server.close();
		await Promise.all(
			[...children].map(async (child) => {
				try {
					process.kill(-child.pid, "SIGTERM");
				} catch {}
				const timer = setTimeout(() => {
					try {
						process.kill(-child.pid, "SIGKILL");
					} catch {}
				}, 5000);
				try {
					await child.done;
				} catch {
				} finally {
					clearTimeout(timer);
				}
			}),
		);
		if (claimed) {
			release("stack:lighthouse", owner);
			claimed = false;
		}
	}
	const interrupted = () => {
		void cleanup().finally(() => process.exit(130));
	};
	process.once("SIGINT", interrupted);
	process.once("SIGTERM", interrupted);
	try {
		claim("stack:lighthouse", {
			owner,
			worktree: root,
			pid: process.pid,
			identity: processIdentity(process.pid),
			ports: { web: 3390, api: 3391 },
		});
		claimed = true;
		server.listen(3391, "127.0.0.1");
		await once(server, "listening");
		await start("pnpm", ["--filter", "@opnshelf/web", "run", "build"]).done;
		const nitro = start(
			process.execPath,
			["apps/web/.output/server/index.mjs"],
			".lighthouseci/server.log",
		);
		await Promise.race([
			nitro.done.then(() => {
				throw new Error("Nitro exited before audits");
			}),
			(async () => {
				for (let attempt = 0; attempt < 60; attempt++) {
					try {
						if ((await fetch("http://127.0.0.1:3390/privacy")).ok) return;
					} catch {}
					await new Promise((resolve) => setTimeout(resolve, 500));
				}
				throw new Error(
					"Nitro readiness timed out; see .lighthouseci/server.log",
				);
			})(),
		]);
		const collect = ["exec", "lhci", "collect"];
		if (process.env.LHCI_RUNS)
			collect.push(`--numberOfRuns=${Number(process.env.LHCI_RUNS)}`);
		await start("pnpm", collect).done;
		await start("pnpm", ["exec", "lhci", "assert"]).done;
		assert.deepEqual(errors, [], "Unexpected fixture API requests");
		const reports = readdirSync(".lighthouseci")
			.filter((file) => /^lhr-.*\.json$/.test(file))
			.map((file) => JSON.parse(readFileSync(`.lighthouseci/${file}`)));
		assert.equal(
			reports.length,
			pages.length * runs,
			"Incomplete Lighthouse reports",
		);
		for (const page of pages)
			assert.equal(
				reports.filter(
					(report) => report.requestedUrl === webOrigin + page.path,
				).length,
				runs,
				`Missing runs for ${page.name}`,
			);
		for (const report of reports) validateReport(report);
		const summary = [
			"# Authenticated Lighthouse reports",
			"",
			"Scores are informational. Authentication, populated content and fixture failures block CI.",
			"",
			"| Page | Runs | Median performance | Median accessibility |",
			"| --- | --- | --- | --- |",
		];
		const median = (values) =>
			values.sort((a, b) => a - b)[Math.floor(values.length / 2)];
		for (const page of pages) {
			const matching = reports.filter(
				(report) => report.requestedUrl === webOrigin + page.path,
			);
			const score = (category) =>
				Math.round(
					100 *
						median(matching.map((report) => report.categories[category].score)),
				);
			summary.push(
				`| ${page.name} | ${matching.length} | ${score("performance")} | ${score("accessibility")} |`,
			);
		}
		summary.push(
			"",
			"Download the lighthouse-authenticated artifact for all HTML/JSON reports. Synthetic API data; external TMDB images; mobile browser emulation.",
		);
		writeFileSync(".lighthouseci/summary.md", summary.join("\n") + "\n");
		if (process.env.GITHUB_STEP_SUMMARY)
			appendFileSync(
				process.env.GITHUB_STEP_SUMMARY,
				summary.join("\n") + "\n",
			);
		console.log(summary.join("\n"));
	} finally {
		await cleanup();
		process.removeListener("SIGINT", interrupted);
		process.removeListener("SIGTERM", interrupted);
	}
}

if (
	process.argv[1] &&
	resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	run().catch((error) => {
		console.error(error);
		process.exitCode = 1;
	});
}
