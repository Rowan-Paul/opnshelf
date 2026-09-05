import { Logger } from "@nestjs/common";
import type { Request } from "express";
import {
	getClientIp,
	mapConfirmEmailError,
	mapCreateAccountError,
} from "./signup-support";

describe("signup-support", () => {
	const logger = new Logger("test");
	beforeEach(() => {
		vi.spyOn(logger, "error").mockImplementation(() => undefined);
	});

	describe("getClientIp", () => {
		it("prefers req.ip, then the first X-Forwarded-For hop", () => {
			expect(
				getClientIp({ ip: "1.2.3.4", headers: {} } as unknown as Request),
			).toBe("1.2.3.4");
			expect(
				getClientIp({
					headers: { "x-forwarded-for": "5.6.7.8, 10.0.0.1" },
				} as unknown as Request),
			).toBe("5.6.7.8");
			expect(
				getClientIp({
					headers: { "x-forwarded-for": ["9.9.9.9"] },
				} as unknown as Request),
			).toBe("9.9.9.9");
			expect(getClientIp({ headers: {} } as unknown as Request)).toBe(
				"unknown",
			);
		});
	});

	describe("mapCreateAccountError", () => {
		const statusOf = (error: unknown) =>
			mapCreateAccountError(error, logger).getStatus();

		it("maps taken identities to 409 and bad input to 400", () => {
			expect(statusOf({ error: "HandleNotAvailable" })).toBe(409);
			expect(statusOf({ error: "HandleTaken" })).toBe(409);
			expect(statusOf({ error: "AccountAlreadyExists" })).toBe(409);
			expect(statusOf({ error: "EmailTaken" })).toBe(409);
			expect(statusOf({ error: "InvalidHandle" })).toBe(400);
			expect(statusOf({ error: "InvalidEmail" })).toBe(400);
		});

		it("treats a rejected invite code as our own outage", () => {
			expect(statusOf({ error: "InvalidInviteCode", message: "nope" })).toBe(
				503,
			);
			expect(statusOf({ error: "InviteCodeRequired" })).toBe(503);
			expect(logger.error).toHaveBeenCalled();
		});

		it("falls back to a 400 carrying the PDS message", () => {
			const mapped = mapCreateAccountError(
				{ error: "Weird", message: "Something odd" },
				logger,
			);
			expect(mapped.getStatus()).toBe(400);
			expect(mapped.message).toBe("Something odd");
			expect(mapCreateAccountError(new Error("plain"), logger).message).toBe(
				"plain",
			);
			expect(mapCreateAccountError(undefined, logger).message).toBe(
				"Account creation failed",
			);
		});
	});

	describe("mapConfirmEmailError", () => {
		it("explains expired and invalid codes without logging", () => {
			expect(
				mapConfirmEmailError({ error: "ExpiredToken" }, logger).message,
			).toBe("That code has expired. Request a new one.");
			expect(
				mapConfirmEmailError({ error: "InvalidToken" }, logger).message,
			).toBe("That code is invalid.");
			expect(logger.error).not.toHaveBeenCalled();
		});

		it("logs anything else and answers generically", () => {
			const mapped = mapConfirmEmailError(new Error("boom"), logger);
			expect(mapped.getStatus()).toBe(400);
			expect(mapped.message).toBe(
				"Could not verify that code. Please try again.",
			);
			expect(logger.error).toHaveBeenCalled();
		});
	});
});
