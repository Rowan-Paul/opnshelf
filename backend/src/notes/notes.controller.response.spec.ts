import { type ExecutionContext, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { JsonNullExpressAdapter } from "../common/json-null-express-adapter";

vi.mock("./notes.service", () => ({
	NotesService: class MockNotesService {},
}));
vi.mock("../auth/auth.guard", () => ({
	AuthGuard: class MockAuthGuard {
		canActivate(context: ExecutionContext) {
			context.switchToHttp().getRequest().user = { did: "did:plc:test" };
			return true;
		}
	},
}));
vi.mock("../auth/optional-auth.guard", () => ({
	OptionalAuthGuard: class MockOptionalAuthGuard {},
}));
vi.mock("../privacy/content-privacy.guard", () => ({
	ContentPrivacyGuard: class MockContentPrivacyGuard {},
}));
vi.mock("../privacy/content-privacy.interceptor", () => ({
	ContentPrivacyCategory: () => () => {},
	ContentPrivacyInterceptor: class MockContentPrivacyInterceptor {},
}));

import { NotesController } from "./notes.controller";
import { NotesService } from "./notes.service";

describe("GET /notes/user/:userDid response", () => {
	let app: INestApplication;
	const getNote = vi.fn();
	const getResponse = () =>
		request(app.getHttpServer())
			.get("/notes/user/did:plc:test")
			.query({ mediaType: "movie", mediaId: "603" });

	beforeAll(async () => {
		const module = await Test.createTestingModule({
			controllers: [NotesController],
			providers: [{ provide: NotesService, useValue: { getNote } }],
		}).compile();
		app = module.createNestApplication(new JsonNullExpressAdapter(), {
			logger: false,
		});
		await app.init();
	});

	afterAll(async () => {
		await app?.close();
	});

	it("returns explicit JSON null for a missing note", async () => {
		getNote.mockResolvedValue(null);
		const response = await getResponse();

		expect(response.status).toBe(200);
		expect(response.text).toBe("null");
		expect(response.headers["content-type"]).toMatch(/^application\/json\b/);
		expect(response.body).toBeNull();
	});

	it("returns the note as JSON when it exists", async () => {
		const date = new Date("2026-01-01T00:00:00Z");
		getNote.mockResolvedValue({
			id: "note-id",
			rkey: "note-key",
			content: "A note",
			mediaType: "movie",
			mediaId: "603",
			createdAt: date,
			updatedAt: date,
		});

		const response = await getResponse();
		expect(response.status).toBe(200);
		expect(response.body).toMatchObject({ id: "note-id", content: "A note" });
	});
});
