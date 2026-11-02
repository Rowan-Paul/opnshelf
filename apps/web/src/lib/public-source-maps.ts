import { readdir } from "node:fs/promises";

export async function assertNoPublicSourceMaps(directory: string | URL) {
	const files = await readdir(directory, { recursive: true });
	const map = files.find((file) => /\.map(?:\.(?:gz|br))?$/.test(file));
	if (map) throw new Error(`Source map remains in public build output: ${map}`);
}
