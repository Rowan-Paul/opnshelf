import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const src = join(import.meta.dirname, "..");

function sourceFiles(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) return sourceFiles(path);
		return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)
			? [path]
			: [];
	});
}

/** `file:line` of every `useMutation(...)` call that sets no mutationKey. */
function keylessMutations(file: string): string[] {
	const source = readFileSync(file, "utf8");
	const found: string[] = [];
	for (let start = source.indexOf("useMutation("); start !== -1; ) {
		let depth = 0;
		let end = start + "useMutation".length;
		for (; end < source.length; end++) {
			if (source[end] === "(") depth++;
			else if (source[end] === ")" && --depth === 0) break;
		}
		if (!source.slice(start, end).includes("mutationKey")) {
			const line = source.slice(0, start).split("\n").length;
			found.push(`${relative(src, file)}:${line}`);
		}
		start = source.indexOf("useMutation(", end);
	}
	return found;
}

describe("mutation keys", () => {
	// The MutationCache names each PostHog failure after its mutationKey. A
	// keyless mutation reports as "unknown", which hid the failing endpoint
	// in #631.
	it("gives every useMutation call a mutationKey", () => {
		expect(sourceFiles(src).flatMap(keylessMutations)).toEqual([]);
	});
});
