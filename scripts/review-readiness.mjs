import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const login = (value) => value.toLowerCase().replace(/\[bot\]$/, "");
export function reviewReadiness(pr, reviewer) {
	const reviews = pr.reviews
		.filter(
			(review) =>
				login(review.author.login) === login(reviewer) &&
				review.commit?.oid === pr.headRefOid &&
				review.state !== "COMMENTED",
		)
		.sort((a, b) => (a.submittedAt || "").localeCompare(b.submittedAt || ""));
	const latest = reviews.at(-1);
	return {
		url: pr.url,
		head: pr.headRefOid,
		reviewer,
		state: latest?.state ?? "PENDING",
		ready: latest?.state === "APPROVED",
	};
}
if (
	process.argv[1] &&
	resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	try {
		const [pr, reviewer] = process.argv.slice(2);
		if (!pr || !reviewer)
			throw new Error("Usage: pnpm review:status PR_URL REVIEWER_LOGIN");
		const data = JSON.parse(
			execFileSync(
				"gh",
				["pr", "view", pr, "--json", "url,headRefOid,reviews"],
				{ encoding: "utf8" },
			),
		);
		const result = reviewReadiness(data, reviewer);
		console.log(JSON.stringify(result, null, 2));
		if (!result.ready) process.exitCode = 1;
	} catch (error) {
		console.error(error.message);
		process.exitCode = 1;
	}
}
