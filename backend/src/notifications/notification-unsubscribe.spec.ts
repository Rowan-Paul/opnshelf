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
	it("keeps the settings footer when signing is unavailable in development", () => {
		const url = unsubscribeUrl(
			mockEnvironment(),
			"did:plc:alice",
			"alice@example.com",
			"Stats",
		);
		expect(url).toBeUndefined();
		const email = notificationEmail({
			title: "Notification",
			body: "Hello",
			url: null,
			baseUrl: "https://opnshelf.xyz",
			unsubscribeUrl: url,
		});
		expect(email.text).toContain(
			"Manage notifications: https://opnshelf.xyz/settings/notifications",
		);
	});
	it.each(Object.keys(emailCategories))(
		"unsubscribes only %s without a session, after confirmation",
		async (category) => {
			const updateMany = vi.fn().mockResolvedValue({ count: 1 });
			const findUnique = vi
				.fn()
				.mockResolvedValue({ email: "alice@example.com" });
			const module = await Test.createTestingModule({
				controllers: [NotificationUnsubscribeController],
				providers: [
					{ provide: BackendEnv, useValue: config },
					{
						provide: PrismaService,
						useValue: { notificationSettings: { updateMany, findUnique } },
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
					) ?? "",
				);
				const path = `${url.pathname}${url.search}`;
				const tokenBody = JSON.parse(
					Buffer.from(
						(url.searchParams.get("token") ?? "").split(".")[0],
						"base64url",
					).toString(),
				);
				expect(tokenBody).not.toHaveProperty("email");
				expect(JSON.stringify(tokenBody)).not.toContain("alice@example.com");
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
				expect(email.text).toContain(
					"Manage notifications: https://opnshelf.xyz/settings/notifications",
				);
				expect(email.html).toContain(
					'href="https://opnshelf.xyz/settings/notifications"',
				);
				expect(email.html.match(/Manage notifications/g)).toHaveLength(1);
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
						.expect(200)
						.expect(/You're unsubscribed/);
				}
				expect(updateMany).toHaveBeenCalledWith({
					where: { userDid: "did:plc:alice", email: "alice@example.com" },
					data: { [`email${category}`]: false },
				});
				updateMany.mockClear();
				findUnique.mockResolvedValue({ email: "changed@example.com" });
				await request(app.getHttpServer())
					.post(path)
					.expect(200)
					.expect(/address you no longer use/);
				expect(updateMany).not.toHaveBeenCalled();
				findUnique.mockResolvedValue({ email: "alice@example.com" });
				updateMany.mockResolvedValue({ count: 0 });
				await request(app.getHttpServer())
					.post(path)
					.expect(200)
					.expect(/address changed/);
				updateMany.mockClear();
				await request(app.getHttpServer())
					.post(`${path}tampered`)
					.expect(400)
					.expect("Content-Type", /text\/html/)
					.expect(/link is invalid/);
				await request(app.getHttpServer())
					.get(`${path}tampered`)
					.expect(400)
					.expect(/link is invalid/);
				await request(app.getHttpServer())
					.post("/notifications/unsubscribe")
					.expect(400);
				const invalid = new URL(
					unsubscribeUrl(
						config,
						"did:plc:alice",
						"alice@example.com",
						"Unknown",
					) ?? "",
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
