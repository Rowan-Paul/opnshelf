import { spawnSync } from "node:child_process";

const unsupportedTurboArgs = new Set(["--write", "--unsafe"]);
const forwardedArgs = process.argv
	.slice(2)
	.filter((arg) => !unsupportedTurboArgs.has(arg));

const result = spawnSync("tsc", ["--noEmit", "-p", "tsconfig.json", ...forwardedArgs], {
	stdio: "inherit",
});

if (result.error) {
	throw result.error;
}

process.exit(result.status ?? 1);
