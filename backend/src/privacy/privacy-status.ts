import { requireWatchSession } from "./watch-operation";

export type SpacesAvailability = "available" | "unsupported" | "unavailable";
const availabilityCache = new WeakMap<
	object,
	{ until: number; value: SpacesAvailability }
>();

/** Probe the standard endpoint, without requiring an experimental PDS flag or
 * a vendor capability. Scope denial still proves that the endpoint exists. */
export async function spacesAvailability(
	session: unknown,
): Promise<SpacesAvailability> {
	if (!session || typeof session !== "object") return "unavailable";
	const cached = availabilityCache.get(session);
	if (cached && cached.until > Date.now()) return cached.value;
	const value = await probeAvailability(session);
	availabilityCache.set(session, {
		value,
		until: Date.now() + (value === "unavailable" ? 5000 : 30000),
	});
	return value;
}
async function probeAvailability(session: object): Promise<SpacesAvailability> {
	try {
		const response = await requireWatchSession(session).fetchHandler(
			"/xrpc/com.atproto.space.listSpaces?limit=1",
			{ signal: AbortSignal.timeout(5000) },
		);
		if (response.ok) return "available";
		const body: unknown = await response.json();
		const code =
			body && typeof body === "object" && "error" in body
				? body.error
				: undefined;
		if (code === "InsufficientScope") return "available";
		if (
			["NotImplemented", "MethodNotImplemented", "XRPCNotSupported"].includes(
				String(code),
			)
		)
			return "unsupported";
		return "unavailable";
	} catch {
		return "unavailable";
	}
}
