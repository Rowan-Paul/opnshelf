import { ConfigService } from "@nestjs/config";
import { CaptchaService } from "./captcha.service";

function makeConfig(values: Record<string, string | undefined>): ConfigService {
	return {
		get: (key: string) => values[key],
	} as unknown as ConfigService;
}

describe("CaptchaService", () => {
	const originalFetch = global.fetch;

	afterEach(() => {
		global.fetch = originalFetch;
		jest.restoreAllMocks();
	});

	it("passes through when disabled (no secret configured)", async () => {
		const service = new CaptchaService(makeConfig({}));
		await expect(service.verify(undefined)).resolves.toBe(true);
	});

	it("rejects an empty token when enabled", async () => {
		const service = new CaptchaService(
			makeConfig({ TURNSTILE_SECRET_KEY: "secret" }),
		);
		const fetchMock = jest.fn();
		global.fetch = fetchMock as unknown as typeof fetch;

		await expect(service.verify("")).resolves.toBe(false);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("returns true when siteverify succeeds", async () => {
		const service = new CaptchaService(
			makeConfig({ TURNSTILE_SECRET_KEY: "secret" }),
		);
		global.fetch = jest.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ success: true }),
		}) as unknown as typeof fetch;

		await expect(service.verify("token", "1.2.3.4")).resolves.toBe(true);
	});

	it("returns false when siteverify reports failure", async () => {
		const service = new CaptchaService(
			makeConfig({ TURNSTILE_SECRET_KEY: "secret" }),
		);
		global.fetch = jest.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ success: false, "error-codes": ["bad"] }),
		}) as unknown as typeof fetch;

		await expect(service.verify("token")).resolves.toBe(false);
	});

	it("returns false when siteverify throws", async () => {
		const service = new CaptchaService(
			makeConfig({ TURNSTILE_SECRET_KEY: "secret" }),
		);
		global.fetch = jest
			.fn()
			.mockRejectedValue(new Error("network")) as unknown as typeof fetch;

		await expect(service.verify("token")).resolves.toBe(false);
	});
});
