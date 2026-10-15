import {
	HttpException,
	HttpStatus,
	Logger,
	type ArgumentsHost,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { TmdbServiceError, tmdbErrorForResponse } from "../tmdb/tmdb-http";
import { AllExceptionsFilter } from "./http-exception.filter";

describe("AllExceptionsFilter", () => {
	afterEach(() => vi.restoreAllMocks());

	it("logs a safe conflict reason and route without sensitive request data", () => {
		const log = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
		const response = {
			locals: { requestId: "request-456" },
			setHeader: vi.fn(),
			status: vi.fn().mockReturnThis(),
			json: vi.fn(),
		};
		const request = {
			method: "POST",
			url: "/users/private-account/privacy?code=secret-code",
			route: { path: "/users/:id/privacy" },
			headers: { authorization: "Bearer secret-token" },
			body: { password: "secret-password" },
		};
		const host = {
			switchToHttp: () => ({
				getResponse: () => response,
				getRequest: () => request,
			}),
		} as ArgumentsHost;
		const filter = new AllExceptionsFilter();
		filter.catch(
			new HttpException(
				"Another Watch operation is in progress. Try again.",
				HttpStatus.CONFLICT,
			),
			host,
		);
		expect(log).toHaveBeenLastCalledWith(
			"POST /users/:id/privacy request_id=request-456 -> 409 reason=privacy_account_busy",
		);
		filter.catch(
			new HttpException(
				"Finish this privacy change before reversing it.",
				HttpStatus.CONFLICT,
			),
			host,
		);
		expect(log).toHaveBeenLastCalledWith(
			"POST /users/:id/privacy request_id=request-456 -> 409 reason=privacy_migration_conflict",
		);
		filter.catch(
			new HttpException(
				"Upstream failed with secret-password",
				HttpStatus.CONFLICT,
			),
			host,
		);
		expect(log).toHaveBeenLastCalledWith(
			"POST /users/:id/privacy request_id=request-456 -> 409",
		);
		filter.catch(new HttpException("constructor", HttpStatus.CONFLICT), host);
		expect(log).toHaveBeenLastCalledWith(
			"POST /users/:id/privacy request_id=request-456 -> 409",
		);
		expect(JSON.stringify(log.mock.calls)).not.toMatch(
			/secret|private-account/,
		);
	});

	it("excludes query parameters when no route was matched", () => {
		const log = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
		const response = {
			setHeader: vi.fn(),
			status: vi.fn().mockReturnThis(),
			json: vi.fn(),
		};
		const host = {
			switchToHttp: () => ({
				getResponse: () => response,
				getRequest: () => ({
					method: "GET",
					url: "/auth/callback?code=private",
				}),
			}),
		} as ArgumentsHost;
		new AllExceptionsFilter().catch(
			new HttpException("Not found", HttpStatus.NOT_FOUND),
			host,
		);
		expect(log).toHaveBeenCalledWith(
			"GET /auth/callback request_id=unknown -> 404",
		);
	});

	it("prevents an exception response from inheriting public caching", () => {
		const log = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
		const response = {
			locals: { requestId: "request-123" },
			setHeader: vi.fn(),
			status: vi.fn().mockReturnThis(),
			json: vi.fn(),
		} as unknown as Response;
		const request = { method: "GET", url: "/movies/tmdb/0" } as Request;
		const host = {
			switchToHttp: () => ({
				getResponse: () => response,
				getRequest: () => request,
			}),
		} as ArgumentsHost;

		new AllExceptionsFilter().catch(
			new HttpException("Not found", HttpStatus.NOT_FOUND),
			host,
		);

		expect(response.setHeader).toHaveBeenCalledWith(
			"Cache-Control",
			"private, no-store",
		);
		expect(response.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
		expect(log).toHaveBeenCalledWith(
			"GET /movies/tmdb/0 request_id=request-123 -> 404",
		);
		log.mockRestore();
	});
});

const catalogueErrorCases: [Error, number, string][] = [
	...[401, 403, 422, 429, 503].map<[Error, number, string]>((status) => [
		tmdbErrorForResponse(new Response(null, { status }), "Episode not found"),
		500,
		"Internal server error",
	]),
	[
		tmdbErrorForResponse(
			new Response(null, { status: 404 }),
			"Episode not found",
		),
		404,
		"Episode not found",
	],
	[
		tmdbErrorForResponse(
			new Response(null, { status: 404 }),
			"Season not found",
		),
		404,
		"Season not found",
	],
	[
		new TmdbServiceError("upstream private details", 503),
		500,
		"Internal server error",
	],
	[new Error("private details"), 500, "Internal server error"],
];
it.each(catalogueErrorCases)(
	"maps catalogue errors at the HTTP boundary: %s",
	(error, status, message) => {
		const warn = vi
			.spyOn(Logger.prototype, "warn")
			.mockImplementation(() => {});
		const logError = vi
			.spyOn(Logger.prototype, "error")
			.mockImplementation(() => {});
		const response = {
			setHeader: vi.fn(),
			status: vi.fn().mockReturnThis(),
			json: vi.fn(),
		};
		const host = {
			switchToHttp: () => ({
				getResponse: () => response,
				getRequest: () => ({
					method: "GET",
					url: "/shows/tmdb/252608/season/2/episode/1",
				}),
			}),
		} as ArgumentsHost;
		new AllExceptionsFilter().catch(error, host);
		expect(response.status).toHaveBeenCalledWith(status);
		expect(response.json).toHaveBeenCalledWith({
			statusCode: status,
			message,
			error: status === 404 ? "Not Found" : "Internal Server Error",
		});
		expect(response.setHeader).toHaveBeenCalledWith(
			"Cache-Control",
			"private, no-store",
		);
		warn.mockRestore();
		logError.mockRestore();
	},
);
