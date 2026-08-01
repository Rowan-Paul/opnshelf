import { describe, expect, it } from "vitest";
import { SessionThrottlerGuard } from "./session-throttler.guard";

// The guard's only logic is the tracker key, so poke it directly rather than
// standing up a Nest testing module.
class TestGuard extends SessionThrottlerGuard {
	track(req: Record<string, unknown>) {
		return this.getTracker(req);
	}
}

describe("SessionThrottlerGuard", () => {
	const guard = Object.create(TestGuard.prototype) as TestGuard;

	it("keys on the bearer token", async () => {
		await expect(
			guard.track({ headers: { authorization: "Bearer abc" }, ip: "1.1.1.1" }),
		).resolves.toBe("session:abc");
	});

	it("keys on the session cookie", async () => {
		await expect(
			guard.track({ headers: {}, cookies: { session: "xyz" }, ip: "1.1.1.1" }),
		).resolves.toBe("session:xyz");
	});

	it("gives two sessions from the same IP separate buckets", async () => {
		const a = await guard.track({ cookies: { session: "a" }, ip: "1.1.1.1" });
		const b = await guard.track({ cookies: { session: "b" }, ip: "1.1.1.1" });
		expect(a).not.toBe(b);
	});

	it("falls back to the IP when there is no session", async () => {
		await expect(guard.track({ headers: {}, ip: "1.1.1.1" })).resolves.toBe(
			"ip:1.1.1.1",
		);
	});
});
