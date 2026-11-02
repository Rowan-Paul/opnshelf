import { Test } from "@nestjs/testing";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { BackendEnv } from "../config/env.schema";
import { PrismaService } from "../prisma/prisma.service";
import { notificationEmail } from "./notification-content";
import { emailCategories, unsubscribeUrl } from "./notification-unsubscribe";
import { NotificationUnsubscribeController } from "./notification-unsubscribe.controller";
import { mockEnvironment } from "../../test/env";

const config = mockEnvironment({
	PROVIDER_STATE_SECRET: "test-unsubscribe-signing-secret",
	BACKEND_PUBLIC_URL: "https://api.example.com",
});

describe("email unsubscribe", () => {
	it.each(Object.keys(emailCategories))(
		"unsubscribes only %s without a session, after confirmation",
		async (category) => {
			const updateMany = vi.fn().mockResolvedValue({ count: 1 });
			const module = await Test.createTestingModule({
				controllers: [NotificationUnsubscribeController],
				providers: [
					{ provide: BackendEnv, useValue: config },
					{
						provide: PrismaService,
						useValue: { notificationSettings: { updateMany } },
					},
				],
			}).compile();
			const app = module.createNestApplication();
			await app.init();
			try {
				const url = new URL(
					unsubscribeUrl(
						config,
						"did:plc:alice",
						"alice@example.com",
						category,
					),
				);
				const path = `${url.pathname}${url.search}`;
				const email = notificationEmail({
					title: "Notification",
					body: "Hello",
					url: null,
					baseUrl: "https://opnshelf.xyz",
					unsubscribeUrl: url.toString(),
				});
				expect(email.text).toContain(
					`Unsubscribe from this email type: ${url}`,
				);
				expect(
					email.html.match(/Unsubscribe from this email type/g),
				).toHaveLength(1);
				await request(app.getHttpServer())
					.get(path)
					.expect(200)
					.expect(/<form method="post"/);
				expect(updateMany).not.toHaveBeenCalled();
				for (let attempt = 0; attempt < 2; attempt++) {
					await request(app.getHttpServer())
						.post(path)
						.expect(201)
						.expect(/You're unsubscribed/);
				}
				expect(updateMany).toHaveBeenCalledWith({
					where: { userDid: "did:plc:alice", email: "alice@example.com" },
					data: { [`email${category}`]: false },
				});
				updateMany.mockClear();
				await request(app.getHttpServer()).post(`${path}tampered`).expect(400);
				await request(app.getHttpServer())
					.post("/notifications/unsubscribe")
					.expect(400);
				const invalid = new URL(
					unsubscribeUrl(
						config,
						"did:plc:alice",
						"alice@example.com",
						"Unknown",
					),
				);
				await request(app.getHttpServer())
					.post(`${invalid.pathname}${invalid.search}`)
					.expect(400);
				expect(updateMany).not.toHaveBeenCalled();
			} finally {
				await app.close();
			}
		},
	);
});
