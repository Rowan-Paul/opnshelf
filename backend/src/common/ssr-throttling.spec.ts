const { env } = vi.hoisted(() => ({
	env: { SSR_RATE_LIMIT_SECRET: undefined as string | undefined },
}));
vi.mock("../config/env", () => ({ env }));
import { createHmac } from "node:crypto";
import { type ExecutionContext, HttpException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { ThrottlerModule } from "@nestjs/throttler";
import { afterEach, expect, it, vi } from "vitest";
import { AuthService } from "../auth/auth.service";
import { SessionThrottlerGuard } from "./session-throttler.guard";

const secret = "test-only-ssr-forwarding-key-at-least-32-characters";
function headers(ip: string) {
	const timestamp = String(Date.now());
	return {
		"x-opnshelf-client-ip": ip,
		"x-opnshelf-client-time": timestamp,
		"x-opnshelf-client-signature": createHmac("sha256", secret)
			.update(`${ip}\n${timestamp}`)
			.digest("hex"),
	};
}

afterEach(() => {
	env.SSR_RATE_LIMIT_SECRET = undefined;
});

it("keeps another SSR visitor out of an exhausted crawler bucket", async () => {
	env.SSR_RATE_LIMIT_SECRET = secret;
	const module = await Test.createTestingModule({
		imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }])],
		providers: [
			SessionThrottlerGuard,
			{ provide: AuthService, useValue: { isKnownSession: () => false } },
		],
	}).compile();
	const guard = module.get(SessionThrottlerGuard);
	await guard.onModuleInit();
	class ShowsController {}
	const handler = () => undefined;
	const call = (forwarded: Record<string, string>) =>
		guard.canActivate({
			getClass: () => ShowsController,
			getHandler: () => handler,
			switchToHttp: () => ({
				getRequest: () => ({ ip: "192.0.2.1", headers: forwarded }),
				getResponse: () => ({ header: vi.fn() }),
			}),
		} as unknown as ExecutionContext);
	try {
		for (let i = 0; i < 100; i++) await call(headers("198.51.100.1"));
		await expect(call(headers("198.51.100.1"))).rejects.toThrow(
			"ThrottlerException: Too Many Requests",
		);
		await expect(call(headers("198.51.100.2"))).resolves.toBe(true);
		// Forged identities must still share the ordinary peer-IP bucket.
		for (let i = 0; i < 100; i++)
			await call({ "x-opnshelf-client-ip": `198.51.100.${i}` });
		await expect(
			call({ "x-opnshelf-client-ip": "203.0.113.1" }),
		).rejects.toBeInstanceOf(HttpException);
		const valid = headers("203.0.113.1");
		for (const forged of [
			{ ...valid, "x-opnshelf-client-ip": "203.0.113.2" },
			{ ...valid, "x-opnshelf-client-signature": "0".repeat(64) },
			{ ...valid, "x-opnshelf-client-time": "invalid" },
		])
			await expect(call(forged)).rejects.toBeInstanceOf(HttpException);
		const staleTime = String(Date.now() - 120_000);
		await expect(
			call({
				...valid,
				"x-opnshelf-client-time": staleTime,
				"x-opnshelf-client-signature": createHmac("sha256", secret)
					.update(`203.0.113.1\n${staleTime}`)
					.digest("hex"),
			}),
		).rejects.toBeInstanceOf(HttpException);
		env.SSR_RATE_LIMIT_SECRET = undefined;
		await expect(call(valid)).rejects.toBeInstanceOf(HttpException);
	} finally {
		await module.close();
	}
});
