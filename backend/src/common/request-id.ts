import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";

export const requestContext = new AsyncLocalStorage<{ requestId: string }>();

/**
 * Give every request a correlation ID. It is returned as X-Request-ID (CORS
 * exposes it in main.ts), stored for AllExceptionsFilter's log line, and
 * forwarded by the clients' mutation failure reports, so a PostHog event leads
 * to the backend log line for the same request. Generated server-side only: an
 * inbound header is never trusted, so a client cannot inject log content.
 */
export const assignRequestId: RequestHandler = (_request, response, next) => {
	const requestId = randomUUID();
	response.locals.requestId = requestId;
	response.setHeader("X-Request-ID", requestId);
	// Account data is never a shared cache entry. Explicit catalogue routes
	// may override this header with their public metadata cache policy.
	response.setHeader("Cache-Control", "private, no-store");
	requestContext.run({ requestId }, next);
};
