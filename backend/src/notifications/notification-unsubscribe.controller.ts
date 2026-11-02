import {
	Controller,
	Get,
	Header,
	HttpCode,
	Post,
	Query,
	Res,
} from "@nestjs/common";
import type { Response } from "express";
import { ApiExcludeController } from "@nestjs/swagger";
import { BackendEnv } from "../config/env.schema";
import { PrismaService } from "../prisma/prisma.service";
import {
	emailCategories,
	unsubscribeEmailTag,
	verifyUnsubscribe,
} from "./notification-unsubscribe";

function page(content: string) {
	return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Unsubscribe · Opnshelf</title><style>body{margin:0;padding:24px;font:16px/1.6 system-ui,sans-serif;color:#0f172a;background:#f8fafc}main{max-width:560px;margin:48px auto;padding:24px;background:white;border-radius:16px}h1{font-size:28px;line-height:1.2}button{font:inherit;font-weight:600;padding:12px 20px;border:0;border-radius:8px;background:#f3bc00;color:#3f2e00;cursor:pointer}</style><body><main><h1>Email notifications</h1>${content}</main></body></html>`;
}

/** Browser-only flow: GET is safe for mail scanners; POST needs no account session. */
@ApiExcludeController()
@Controller("notifications/unsubscribe")
export class NotificationUnsubscribeController {
	constructor(
		private readonly config: BackendEnv,
		private readonly prisma: PrismaService,
	) {}

	@Get()
	@Header("Content-Type", "text/html; charset=utf-8")
	@Header("Cache-Control", "no-store")
	@Header("Referrer-Policy", "no-referrer")
	confirm(
		@Query("token") token: string,
		@Res({ passthrough: true }) response: Response,
	) {
		const payload = verifyUnsubscribe(this.config.PROVIDER_STATE_SECRET, token);
		if (!payload) {
			response.status(400);
			return page(
				"<p>This unsubscribe link is invalid. Use the link in a recent notification email.</p>",
			);
		}
		return page(
			`<p>Stop receiving emails about ${emailCategories[payload.category]}?</p><form method="post" action="?token=${encodeURIComponent(token)}"><button type="submit">Unsubscribe</button></form><p>Your other email and push preferences will stay the same.</p>`,
		);
	}

	@Post()
	@HttpCode(200)
	@Header("Content-Type", "text/html; charset=utf-8")
	@Header("Cache-Control", "no-store")
	@Header("Referrer-Policy", "no-referrer")
	async unsubscribe(
		@Query("token") token: string,
		@Res({ passthrough: true }) response: Response,
	) {
		const payload = verifyUnsubscribe(this.config.PROVIDER_STATE_SECRET, token);
		if (!payload) {
			response.status(400);
			return page(
				"<p>This unsubscribe link is invalid. Use the link in a recent notification email.</p>",
			);
		}
		// Binding to the delivery address prevents an old link affecting a new address.
		const settings = await this.prisma.notificationSettings.findUnique({
			where: { userDid: payload.did },
			select: { email: true },
		});
		if (
			!settings?.email ||
			unsubscribeEmailTag(
				this.config.PROVIDER_STATE_SECRET ?? "",
				settings.email,
			) !== payload.emailTag
		) {
			return page(
				"<p>This link is for an address you no longer use. Use the link in a recent notification email, or manage notifications in Settings.</p>",
			);
		}
		const result = await this.prisma.notificationSettings.updateMany({
			where: { userDid: payload.did, email: settings.email },
			data: { [`email${payload.category}`]: false },
		});
		if (!result.count) {
			return page(
				"<p>Your notification address changed. Use the link in a recent notification email, or manage notifications in Settings.</p>",
			);
		}
		return page(
			`<h2>You're unsubscribed</h2><p>You will no longer receive ${emailCategories[payload.category]} emails at the address this email was sent to. Your other email and push preferences stay the same.</p>`,
		);
	}
}
