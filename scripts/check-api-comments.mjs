import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const api = new URL("../packages/api/", import.meta.url);
const ts = createRequire(api)("typescript");
const baselineFile = new URL("./api-comment-baseline.json", import.meta.url);

function* sourceFiles(directory, prefix = "") {
	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		const path = prefix + entry.name;
		const url = new URL(encodeURIComponent(entry.name) + (entry.isDirectory() ? "/" : ""), directory);
		if (entry.isDirectory() && path !== "generated") {
			yield* sourceFiles(url, path + "/");
		} else if (entry.isFile() && /\.[cm]?tsx?$/.test(path)) {
			yield [path, readFileSync(url, "utf8")];
		}
	}
}

const remaining = JSON.parse(readFileSync(baselineFile, "utf8"));
const current = {};
let removableLines = 0;
let additions = 0;
const mode = process.argv[2];
const list = mode === "--list";

for (const [path, text] of sourceFiles(new URL("src/", api))) {
	const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
	const spans = ts.getSyntacticClassifications(
		{ throwIfCancellationRequested() {} },
		source,
		{ start: 0, length: text.length },
	);
	const comments = spans
		.filter(({ classificationType }) => classificationType === "comment")
		.map(({ textSpan }) => textSpan);
	if (list) {
		let end = 0;
		let stripped = "";
		for (const { start, length } of comments) {
			stripped += text.slice(end, start);
			end = start + length;
			stripped += text.slice(start, end).replace(/[^\r\n]/g, " ");
		}
		stripped += text.slice(end);
		const originalLines = text.split(/\r?\n/);
		removableLines += stripped.split(/\r?\n/).filter(
			(line, index) => !line.trim() && originalLines[index].trim(),
		).length;
	}
	for (const { start, length } of comments) {
		const comment = text.slice(start, start + length).replaceAll("\r\n", "\n");
		const first = source.getLineAndCharacterOfPosition(start).line;
		const location = `packages/api/src/${path}:${first + 1}`;
		const key = `${path}:${createHash("sha256").update(comment).digest("hex")}`;
		current[key] = (current[key] ?? 0) + 1;
		if (list) {
			console.log(`${location} ${comment}`);
		} else if ((remaining[key] ?? 0) < 1) {
			console.error(`${location} New or edited comment.`);
			additions++;
		} else {
			remaining[key]--;
		}
	}
}

if (list) {
	console.log(`Approximately ${removableLines} lines could be removed.`);
} else if (additions > 0) {
	process.exitCode = 1;
} else if (mode === "--prune") {
	const sorted = Object.fromEntries(
		Object.keys(current).sort().map((key) => [key, current[key]]),
	);
	writeFileSync(baselineFile, JSON.stringify(sorted, null, 2) + "\n");
} else if (Object.values(remaining).some((count) => count > 0)) {
	console.error("Run pnpm check:api-comments --prune to retire removed comments from the baseline.");
	process.exitCode = 1;
}
