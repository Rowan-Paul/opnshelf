import {
	BadRequestException,
	Body,
	Controller,
	type INestApplication,
	Logger,
	Post,
	ValidationPipe,
} from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { IsString } from "class-validator";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { mapConfirmEmailError } from "../auth/signup-support";
import { syncBusy } from "../integrations/integration-error";
import { AllExceptionsFilter } from "./http-exception.filter";
import { assignRequestId } from "./request-id";

class CodeDto {
	@IsString() code!: string;
}

// Throws the same exceptions the verify-email and integration paths do.
@Controller("contract")
class ContractController {
	@Post("expired")
	expired() {
		throw mapConfirmEmailError({ error: "ExpiredToken" }, new Logger("test"));
	}
	@Post("busy")
	busy() {
		throw syncBusy();
	}
	@Post("validated")
	validated(@Body() _dto: CodeDto) {
		return { ok: true };
	}
	@Post("uncoded")
	uncoded() {
		throw new BadRequestException({ code: "user supplied", message: "no" });
	}
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe("error response contract", () => {
	let app: INestApplication;
	const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => {});

	beforeAll(async () => {
		const mod = await Test.createTestingModule({
			controllers: [ContractController],
		}).compile();
		app = mod.createNestApplication({ logger: false });
		app.use(assignRequestId);
		app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
		app.useGlobalFilters(new AllExceptionsFilter());
		await app.init();
	});
	afterAll(async () => {
		await app.close();
		warn.mockRestore();
	});

	it.each([
		["expired", 400, "EMAIL_CODE_EXPIRED"],
		["busy", 409, "SYNC_BUSY"],
		["validated", 400, "VALIDATION_FAILED"],
	])(
		"POST /contract/%s returns its code and a request ID that matches the log line",
		async (path, status, code) => {
			const response = await request(app.getHttpServer())
				.post(`/contract/${path}`)
				.send({ code: 123456, email: "someone@example.com" });

			expect(response.status).toBe(status);
			expect(response.body.code).toBe(code);
			const requestId = response.headers["x-request-id"];
			expect(requestId).toMatch(uuid);
			const line = String(warn.mock.lastCall?.[0]);
			expect(line).toBe(
				`POST /contract/${path} request_id=${requestId} -> ${status} code=${code}`,
			);
			expect(line).not.toMatch(/123456|example\.com/);
		},
	);

	it("never forwards an unregistered code", async () => {
		const response = await request(app.getHttpServer()).post(
			"/contract/uncoded",
		);

		expect(response.status).toBe(400);
		expect(response.body).not.toHaveProperty("code");
		expect(response.headers["x-request-id"]).toMatch(uuid);
		expect(String(warn.mock.lastCall?.[0])).not.toContain("user supplied");
	});

	it("ignores a client-supplied request ID", async () => {
		const response = await request(app.getHttpServer())
			.post("/contract/busy")
			.set("X-Request-ID", "injected value");

		expect(response.headers["x-request-id"]).toMatch(uuid);
	});
});
