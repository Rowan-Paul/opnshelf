import { Test } from "@nestjs/testing";
import { ThrottlerModule } from "@nestjs/throttler";
import { describe, expect, it } from "vitest";
import { AuthService } from "../auth/auth.service";
import { SessionThrottlerGuard } from "./session-throttler.guard";

// The guard's only logic is the tracker key, so poke it directly rather than
// standing up a Nest testing module for every case.
class TestGuard extends SessionThrottlerGuard {
	track(req: Record<string, unknown>) {
		return this.getTracker(req);
	}
}

const KNOWN_A = "11111111-1111-4111-8111-111111111111";
const KNOWN_B = "22222222-2222-4222-8222-222222222222";
const knownSessions = new Set([KNOWN_A, KNOWN_B]);
const authService = {
	isKnownSession: (id: string) => knownSessions.has(id),
} as Pick<AuthService, "isKnownSession"> as AuthService;

describe("SessionThrottlerGuard", () => {
	const guard = Object.create(TestGuard.prototype) as TestGuard;
	Reflect.set(guard, "authService", authService);
	const ip = "1.1.1.1";

	it("keys a known bearer token on the session", async () => {
		await expect(
			guard.track({ headers: { authorization: `Bearer ${KNOWN_A}` }, ip }),
		).resolves.toBe(`session:${KNOWN_A}`);
	});

	it("keys a known session cookie on the session", async () => {
		await expect(
			guard.track({ headers: {}, cookies: { opnshelf_session: KNOWN_A }, ip }),
		).resolves.toBe(`session:${KNOWN_A}`);
	});

	it("gives two known sessions from the same IP separate buckets", async () => {
		const a = await guard.track({ cookies: { opnshelf_session: KNOWN_A }, ip });
		const b = await guard.track({ cookies: { opnshelf_session: KNOWN_B }, ip });
		expect(a).not.toBe(b);
	});

	it("falls back to the IP for an unknown bearer token", async () => {
		await expect(
			guard.track({ headers: { authorization: "Bearer not-a-session" }, ip }),
		).resolves.toBe(`ip:${ip}`);
	});

	it("gives two unknown bearer tokens from the same IP one bucket", async () => {
		const a = await guard.track({
			headers: { authorization: "Bearer guess-one" },
			ip,
		});
		const b = await guard.track({
			headers: { authorization: "Bearer guess-two" },
			ip,
		});
		expect(a).toBe(`ip:${ip}`);
		expect(b).toBe(a);
	});

	it("falls back to the IP for an unknown session cookie", async () => {
		await expect(
			guard.track({ headers: {}, cookies: { opnshelf_session: "stale" }, ip }),
		).resolves.toBe(`ip:${ip}`);
	});

	it("falls back to the IP when there is no session", async () => {
		await expect(guard.track({ headers: {}, ip })).resolves.toBe(`ip:${ip}`);
	});

	it("receives the AuthService through Nest property injection", async () => {
		// The guard is a global APP_GUARD with no constructor of its own, so this
		// is the wiring production relies on.
		const module = await Test.createTestingModule({
			imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }])],
			providers: [TestGuard, { provide: AuthService, useValue: authService }],
		}).compile();

		await expect(
			module
				.get(TestGuard)
				.track({ headers: { authorization: `Bearer ${KNOWN_A}` }, ip }),
		).resolves.toBe(`session:${KNOWN_A}`);
		await module.close();
	});
});
