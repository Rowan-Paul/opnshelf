import {
	type ArgumentsHost,
	Catch,
	type ExceptionFilter,
	HttpException,
	HttpStatus,
	Logger,
} from "@nestjs/common";
import type { Request, Response } from "express";

interface ErrorBody {
	statusCode: number;
	message: string | string[];
	error: string;
}

// Only these application-owned conflict reasons are safe to log. Arbitrary
// exception messages can contain upstream credentials or user-provided data.
const privacyConflictCodes: Record<string, string> = {
	"Another Watch operation is in progress. Try again.": "privacy_account_busy",
	"Account deletion is in progress.": "privacy_account_deleting",
	"This category is changing privacy. Try again when it finishes.":
		"privacy_category_migrating",
	"Confirm publication before making this data Public.":
		"privacy_publication_unconfirmed",
	"Finish this privacy change before reversing it.":
		"privacy_migration_conflict",
	"Privacy change in progress": "privacy_migration_in_progress",
	"Privacy change is not ready to run.": "privacy_migration_not_ready",
};

/**
 * Global exception filter. Catches every thrown error, logs it, and returns a
 * consistent JSON shape ({ statusCode, message, error }) to the client. Stack
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

		if (exception instanceof HttpException) {
			status = exception.getStatus();
			const res = exception.getResponse();
			if (typeof res === "string") {
				body = { statusCode: status, message: res, error: exception.name };
			} else {
				// Nest's default object response is { statusCode, message, error }.
				const obj = res as Record<string, unknown>;
				body = {
					statusCode: status,
					message: (obj.message as string | string[]) ?? exception.message,
					error: (obj.error as string) ?? exception.name,
				};
			}
		}

		// Log full detail server-side (stack included) but never ship it out.
		// Prefer the route template, which excludes account identifiers, and never
		// log query parameters (OAuth callbacks carry codes there).
		const route = request.route?.path ?? request.url.split("?")[0];
		const logContext = `${request.method} ${route} request_id=${response.locals?.requestId ?? "unknown"}`;
		if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
			this.logger.error(
				`${logContext} -> ${status}`,
				exception instanceof Error ? exception.stack : String(exception),
			);
		} else {
			const code =
				status === HttpStatus.CONFLICT &&
				typeof body.message === "string" &&
				Object.hasOwn(privacyConflictCodes, body.message)
					? privacyConflictCodes[body.message]
					: undefined;
			this.logger.warn(
				`${logContext} -> ${status}${code ? ` reason=${code}` : ""}`,
			);
		}

		// A controller may mark its successful response as publicly cacheable.
		// Never let that policy carry over to an exception response: transient
		// upstream failures and mapped 404s must reach the origin on the next try.
		response.setHeader("Cache-Control", "private, no-store");
		response.status(status).json(body);
	}
}
