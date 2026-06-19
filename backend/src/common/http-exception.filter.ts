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
		const logContext = `${request.method} ${request.url}`;
		if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
			this.logger.error(
				`${logContext} -> ${status}`,
				exception instanceof Error ? exception.stack : String(exception),
			);
		} else {
			this.logger.warn(`${logContext} -> ${status}`);
		}

		response.status(status).json(body);
	}
}
