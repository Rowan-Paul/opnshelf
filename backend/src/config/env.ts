import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { parseEnvironment } from "./env.schema";

// Node preserves already-set deployment variables over backend/.env values.
// Load and validate before Nest imports or constructs any application providers.
if (existsSync(".env")) loadEnvFile(".env");
export const env = Object.freeze(parseEnvironment(process.env));
