import { HttpException, HttpStatus, type ArgumentsHost } from "@nestjs/common";
import type { Request, Response } from "express";
import { AllExceptionsFilter } from "./http-exception.filter";

describe("AllExceptionsFilter", () => {
	it("prevents an exception response from inheriting public caching", () => {
		const response = {
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
	});
});
