import { Controller, Get } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { assignRequestId, requestContext } from "./request-id";

@Controller()
class RequestIdController {
	@Get()
	async get() {
		await new Promise((resolve) => setImmediate(resolve));
		return { requestId: requestContext.getStore()?.requestId };
	}
}

it("keeps each generated request ID through async work without leaking to other requests", async () => {
	const module = await Test.createTestingModule({
		controllers: [RequestIdController],
	}).compile();
	const app = module.createNestApplication();
	app.use(assignRequestId);
	await app.init();
	try {
		const responses = await Promise.all([
			request(app.getHttpServer()).get("/").set("X-Request-ID", "untrusted"),
			request(app.getHttpServer()).get("/"),
		]);
		for (const response of responses) {
			expect(response.status).toBe(200);
			expect(response.body.requestId).toBe(response.headers["x-request-id"]);
			expect(response.body.requestId).toMatch(/^[0-9a-f-]{36}$/);
		}
		expect(responses[0].body.requestId).not.toBe(responses[1].body.requestId);
		expect(requestContext.getStore()).toBeUndefined();
	} finally {
		await app.close();
	}
});
