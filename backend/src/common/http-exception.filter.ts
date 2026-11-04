import {
	type ArgumentsHost,
	Catch,
	type ExceptionFilter,
	HttpException,
	HttpStatus,
	Logger,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { TmdbNotFoundError } from "../tmdb/tmdb-http";
import { type ErrorCode, isErrorCode } from "./error-codes";

interface ErrorBody {
	code?: ErrorCode;
	statusCode: number;
	message: string | string[];
	error: string;
}

// The privacy coordinators throw plain-message conflicts. Map the known,
// application-owned messages to codes; arbitrary exception messages can contain
// upstream credentials or user-provided data, so they never become a code.
const privacyConflictCodes: Record<string, ErrorCode> = {
	"Another Watch operation is in progress. Try again.": "PRIVACY_ACCOUNT_BUSY",
	"Account deletion is in progress.": "PRIVACY_ACCOUNT_DELETING",
	"This category is changing privacy. Try again when it finishes.":
		"PRIVACY_CATEGORY_MIGRATING",
	"Confirm publication before making this data Public.":
		"PRIVACY_PUBLICATION_UNCONFIRMED",
	"Finish this privacy change before reversing it.":
		"PRIVACY_MIGRATION_CONFLICT",
	"Privacy change in progress": "PRIVACY_MIGRATION_IN_PROGRESS",
	"Privacy change is not ready to run.": "PRIVACY_MIGRATION_NOT_READY",
};

function errorCode(
	status: number,
	response: unknown,
	message: string | string[],
): ErrorCode | undefined {
	if (typeof response === "object" && response !== null) {
		const { code } = response as { code?: unknown };
		// Only forward registered codes, never arbitrary ones. SYNC_BUSY is a
		// retry signal clients act on, so it only ever travels with a 409.
		if (
			isErrorCode(code) &&
			(code !== "SYNC_BUSY" || status === HttpStatus.CONFLICT)
		)
			return code;
	}
	// ValidationPipe rejects a body with one message per failed constraint.
	if (status === HttpStatus.BAD_REQUEST && Array.isArray(message))
		return "VALIDATION_FAILED";
	if (
		status === HttpStatus.CONFLICT &&
		typeof message === "string" &&
		Object.hasOwn(privacyConflictCodes, message)
	)
		return privacyConflictCodes[message];
	return undefined;
}

/**
 * Global exception filter. Catches every thrown error, logs it, and returns a
 * consistent JSON shape ({ statusCode, message, error, code? }) to the client.
 * `code` is a registered ErrorCode; it and the request ID (X-Request-ID, see
 * request-id.ts) let a client error report be matched to this log line. Stack
 * traces are logged server-side but never leaked to the response body. For an
 * HttpException we preserve its status and message; unknown errors collapse to
 * a generic 500 so we don't leak internals.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
	private readonly logger = new Logger(AllExceptionsFilter.name);

	catch(exception: unknown, host: ArgumentsHost): void {
		const ctx = host.switchToHttp();
		const response = ctx.getResponse<Response>();
		const request = ctx.getRequest<Request>();

		let status = HttpStatus.INTERNAL_SERVER_ERROR;
		let body: ErrorBody = {
			statusCode: status,
			message: "Internal server error",
			error: "Internal Server Error",
		};

		if (exception instanceof TmdbNotFoundError) {
			status = HttpStatus.NOT_FOUND;
			body = {
				statusCode: status,
				message: exception.message,
				error: "Not Found",
			};
		} else if (exception instanceof HttpException) {
			status = exception.getStatus();
			const res = exception.getResponse();
			if (typeof res === "string") {
				body = { statusCode: status, message: res, error: exception.name };
				const code = errorCode(status, res, res);
				if (code) body.code = code;
			} else {
				// Nest's default object response is { statusCode, message, error }.
				const obj = res as Record<string, unknown>;
				body = {
					statusCode: status,
					message: (obj.message as string | string[]) ?? exception.message,
					error: (obj.error as string) ?? exception.name,
				};
				const code = errorCode(status, obj, body.message);
				if (code) body.code = code;
			}
		}

		// Log full detail server-side (stack included) but never ship it out.
		// Prefer the route template, which excludes account identifiers, and never
		// log query parameters (OAuth callbacks carry codes there).
		const route = request.route?.path ?? request.url.split("?")[0];
		const logLine = `${request.method} ${route} request_id=${response.locals?.requestId ?? "unknown"} -> ${status}${body.code ? ` code=${body.code}` : ""}`;
		if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
			this.logger.error(
				logLine,
				exception instanceof Error ? exception.stack : String(exception),
			);
		} else {
			this.logger.warn(logLine);
		}

		// A controller may mark its successful response as publicly cacheable.
		// Never let that policy carry over to an exception response: transient
		// upstream failures and mapped 404s must reach the origin on the next try.
		response.setHeader("Cache-Control", "private, no-store");
		response.status(status).json(body);
	}
}
