// @vitest-environment node
import { writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { authControllerMeOptions } from "@opnshelf/api";
import { QueryClient } from "@tanstack/react-query";
import { expect, it } from "vitest";
import { currentUserQueryOptions } from "./auth-query";

it.skipIf(!process.env.OPNSHELF_PERF)(
	"compares 20 warm navigation auth checks over loopback HTTP",
	async () => {
		let requests = 0;
		const server = createServer((_req, res) => {
			requests++;
			res.setHeader("Content-Type", "application/json");
			res.end(JSON.stringify({ did: "benchmark", needsOnboarding: false }));
		});
		await new Promise<void>((resolve) =>
			server.listen(0, "127.0.0.1", resolve),
		);
		const address = server.address();
		if (!address || typeof address === "string") throw new Error("No port");
		const options = { baseUrl: `http://127.0.0.1:${address.port}` };
		const results = [];
		try {
			for (const label of ["before", "after"] as const) {
				const samples: number[] = [];
				let requestCount = 0;
				for (let iteration = 0; iteration < 25; iteration++) {
					const client = new QueryClient();
					await (label === "before"
						? client.fetchQuery(authControllerMeOptions(options))
						: client.fetchQuery(currentUserQueryOptions(options))); // session already loaded
					requests = 0;
					const start = performance.now();
					for (let nav = 0; nav < 20; nav++)
						await (label === "before"
							? client.fetchQuery(authControllerMeOptions(options))
							: client.fetchQuery(currentUserQueryOptions(options)));
					if (iteration >= 5) samples.push(performance.now() - start);
					requestCount = requests;
					client.clear();
				}
				samples.sort((a, b) => a - b);
				results.push({
					label,
					medianMs: samples[10],
					p95Ms: samples[18],
					requests: requestCount,
				});
			}
			expect(results[0].requests).toBe(20);
			expect(results[1].requests).toBe(0);
			console.log(JSON.stringify(results));
			if (process.env.PERF_OUTPUT)
				writeFileSync(
					process.env.PERF_OUTPUT,
					JSON.stringify(results, null, 2),
				);
		} finally {
			await new Promise<void>((resolve) => server.close(() => resolve()));
		}
	},
);
