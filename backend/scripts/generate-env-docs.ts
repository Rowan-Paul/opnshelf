import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { environmentTable } from "../src/config/env.schema";

const path = resolve(__dirname, "../../README.md");
const readme = readFileSync(path, "utf8");
const updated = readme.replace(
	/<!-- backend-env:start -->[\s\S]*?<!-- backend-env:end -->/,
	`<!-- backend-env:start -->\n${environmentTable()}\n<!-- backend-env:end -->`,
);
if (updated === readme && !readme.includes(environmentTable())) {
	throw new Error("README backend environment markers are missing");
}
writeFileSync(path, updated);
