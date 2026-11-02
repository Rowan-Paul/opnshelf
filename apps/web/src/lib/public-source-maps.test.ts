import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { assertNoPublicSourceMaps } from "./public-source-maps";

const directories: string[] = [];
afterEach(async () => {
	await Promise.all(
		directories.splice(0).map((dir) => rm(dir, { recursive: true })),
	);
});

it.each([
	"app.js.map",
	"app.js.map.gz",
	"app.js.map.br",
])("rejects a remaining nested %s before public assets are packaged", async (filename) => {
	const directory = await mkdtemp(join(tmpdir(), "opnshelf-sourcemaps-"));
	directories.push(directory);
	await mkdir(join(directory, "assets"));
	await writeFile(join(directory, "assets", "app.js"), "console.log('app')");
	await expect(assertNoPublicSourceMaps(directory)).resolves.toBeUndefined();
	await writeFile(join(directory, "assets", filename), "source map");
	await expect(assertNoPublicSourceMaps(directory)).rejects.toThrow(
		"Source map remains in public build output",
	);
});
