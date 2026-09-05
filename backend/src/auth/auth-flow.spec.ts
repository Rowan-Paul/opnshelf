import type { ConfigService } from "@nestjs/config";
import {
	buildMobileErrorUrl,
	buildWebErrorUrl,
	flowCookieOptions,
	getCookieDomain,
	getFrontendUrl,
	resolveErrorRedirect,
	sessionCookieOptions,
} from "./auth-flow";

const configWith = (values: Record<string, string>) =>
	({ get: (key: string) => values[key] }) as unknown as ConfigService;

describe("auth-flow", () => {
	it("defaults the frontend URL to the local dev server", () => {
		expect(getFrontendUrl(configWith({}))).toBe("http://127.0.0.1:3000");
		expect(getFrontendUrl(configWith({ FRONTEND_URL: "https://x.y" }))).toBe(
			"https://x.y",
		);
	});

	it("marks flow and session cookies secure only in production", () => {
		expect(flowCookieOptions(configWith({ NODE_ENV: "test" }))).toEqual({
			httpOnly: true,
			secure: false,
			sameSite: "lax",
			maxAge: 5 * 60 * 1000,
		});
		expect(
			sessionCookieOptions(configWith({ NODE_ENV: "production" })),
		).toEqual({
			httpOnly: true,
			secure: true,
			sameSite: "lax",
			maxAge: 14 * 24 * 60 * 60 * 1000,
			path: "/",
		});
	});

	describe("getCookieDomain", () => {
		it("only names a domain for a production, non-loopback frontend", () => {
			expect(
				getCookieDomain(
					configWith({
						NODE_ENV: "test",
						FRONTEND_URL: "https://opnshelf.xyz",
					}),
				),
			).toBeUndefined();
			expect(
				getCookieDomain(
					configWith({
						NODE_ENV: "production",
						FRONTEND_URL: "https://opnshelf.xyz",
					}),
				),
			).toBe("opnshelf.xyz");
			expect(
				getCookieDomain(
					configWith({
						NODE_ENV: "production",
						FRONTEND_URL: "http://localhost:3000",
					}),
				),
			).toBeUndefined();
			expect(
				getCookieDomain(
					configWith({ NODE_ENV: "production", FRONTEND_URL: "not a url" }),
				),
			).toBeUndefined();
		});
	});

	describe("error redirects", () => {
		it("builds the web login toast URL and the mobile deep link", () => {
			expect(buildWebErrorUrl("http://127.0.0.1:3000", "auth_failed")).toBe(
				"http://127.0.0.1:3000/login?error=auth_failed",
			);
			expect(buildMobileErrorUrl("handle_required")).toBe(
				"opnshelf://auth/complete?error=handle_required",
			);
		});

		it("routes by platform", () => {
			expect(
				resolveErrorRedirect(
					"http://127.0.0.1:3000",
					"callback_failed",
					"mobile",
				),
			).toBe("opnshelf://auth/complete?error=callback_failed");
			expect(
				resolveErrorRedirect(
					"http://127.0.0.1:3000",
					"callback_failed",
					undefined,
				),
			).toBe("http://127.0.0.1:3000/login?error=callback_failed");
		});
	});
});
