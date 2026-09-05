import {
	BadRequestException,
	ConflictException,
	type HttpException,
	type Logger,
	ServiceUnavailableException,
} from "@nestjs/common";
import type { Request } from "express";

/** The address a signup attempt is charged to by the rate limiter. */
export function getClientIp(req: Request): string {
	// With Express "trust proxy" configured (see main.ts), req.ip already
	// resolves to the real client address from X-Forwarded-For. Prefer it;
	// fall back to manual header parsing only if req.ip is unavailable.
	if (req.ip) {
		return req.ip;
	}
	const forwarded = req.headers["x-forwarded-for"];
	if (typeof forwarded === "string" && forwarded.length > 0) {
		return forwarded.split(",")[0].trim();
	}
	if (Array.isArray(forwarded) && forwarded.length > 0) {
		return forwarded[0];
	}
	return "unknown";
}

/** Map a PDS createAccount XRPC error to an appropriate HTTP response. */
export function mapCreateAccountError(
	error: unknown,
	logger: Logger,
): HttpException {
	const code =
		error && typeof error === "object" && "error" in error
			? String((error as { error?: unknown }).error)
			: undefined;
	const message =
		error && typeof error === "object" && "message" in error
			? String((error as { message?: unknown }).message)
			: "Account creation failed";

	switch (code) {
		case "HandleNotAvailable":
		case "HandleTaken":
		case "AccountAlreadyExists":
			return new ConflictException("That username is already taken");
		case "EmailTaken":
			return new ConflictException("That email is already in use");
		case "InvalidHandle":
			return new BadRequestException("That username is not allowed");
		case "InvalidEmail":
			return new BadRequestException("That email address is invalid");
		case "InvalidInviteCode":
		case "InviteCodeRequired":
			// Our minted code was rejected — that's a server-side problem.
			logger.error(`Invite code rejected by PDS: ${message}`);
			return new ServiceUnavailableException(
				"Signup is temporarily unavailable",
			);
		default:
			logger.error(`createAccount failed (${code}): ${message}`);
			return new BadRequestException(message);
	}
}

/** Map a PDS confirmEmail XRPC error to an appropriate HTTP response. */
export function mapConfirmEmailError(
	error: unknown,
	logger: Logger,
): HttpException {
	const code =
		error && typeof error === "object" && "error" in error
			? String((error as { error?: unknown }).error)
			: undefined;
	switch (code) {
		case "ExpiredToken":
			return new BadRequestException(
				"That code has expired. Request a new one.",
			);
		case "InvalidToken":
			return new BadRequestException("That code is invalid.");
		default:
			logger.error(`confirmEmail failed (${code})`, error);
			return new BadRequestException(
				"Could not verify that code. Please try again.",
			);
	}
}
