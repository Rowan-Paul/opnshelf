import { type BackendEnv, envSchema } from "../src/config/env.schema";

/** Unit fixtures deliberately bypass startup validation to exercise disabled features. */
export function mockEnvironment<T extends object>(
	source: T = {} as T,
): T & BackendEnv {
	const values = { ...source };
	if ("get" in source && typeof source.get === "function") {
		const get = source.get as (key: string) => unknown;
		for (const name of Object.keys(envSchema.shape)) {
			Object.defineProperty(values, name, {
				get: () => get(name),
				configurable: true,
			});
		}
	}
	return values as T & BackendEnv;
}
