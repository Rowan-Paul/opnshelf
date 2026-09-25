import { Injectable } from "@nestjs/common";
import { BackendEnv } from "../config/env.schema";

/** Cloudflare Email Sending REST endpoint. The account id is interpolated at send time. */
const CLOUDFLARE_SEND_URL = (accountId: string) =>
	`https://api.cloudflare.com/client/v4/accounts/${accountId}/email/sending/send`;

@Injectable()
export class EmailService {
	private readonly apiToken?: string;
	private readonly accountId?: string;

	constructor(private readonly config: BackendEnv) {
		this.apiToken = this.config.CLOUDFLARE_API_TOKEN;
		this.accountId = this.config.CLOUDFLARE_ACCOUNT_ID;
	}

	/** Delivery failures are surfaced so the notification worker can retry. */
	async sendNotification(params: {
		to: string;
		subject: string;
		text: string;
		html?: string;
	}): Promise<void> {
		if (!this.apiToken || !this.accountId) {
			throw new Error("Cloudflare Email Sending is not configured");
		}
		const response = await fetch(CLOUDFLARE_SEND_URL(this.accountId), {
			method: "POST",
			headers: {
				Authorization: `Bearer ${this.apiToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				from: { address: "notifications@opnshelf.xyz", name: "Opnshelf" },
				to: params.to,
				subject: params.subject,
				text: params.text,
				html: params.html,
			}),
			signal: AbortSignal.timeout(15_000),
		});
		if (!response.ok) {
			throw new Error(`Notification email failed (HTTP ${response.status})`);
		}
	}
}
