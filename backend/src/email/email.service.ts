import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

/** Cloudflare Email Sending REST endpoint. The account id is interpolated at send time. */
const CLOUDFLARE_SEND_URL = (accountId: string) =>
	`https://api.cloudflare.com/client/v4/accounts/${accountId}/email/sending/send`;

@Injectable()
export class EmailService {
	private readonly logger = new Logger(EmailService.name);
	private readonly apiToken?: string;
	private readonly accountId?: string;
	private readonly from = {
		address: "feedback@opnshelf.xyz",
		name: "Opnshelf",
	};

	constructor(private readonly config: ConfigService) {
		this.apiToken = this.config.get<string>("CLOUDFLARE_API_TOKEN");
		this.accountId = this.config.get<string>("CLOUDFLARE_ACCOUNT_ID");
	}

	async sendFeedbackNotification(params: {
		to: string;
		category: string;
		message: string;
		userHandle: string;
		userDisplayName?: string | null;
		pageUrl?: string;
	}) {
		const { to, category, message, userHandle, userDisplayName, pageUrl } =
			params;

		if (!this.apiToken || !this.accountId) {
			this.logger.warn(
				"Skipping feedback email: CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID not configured",
			);
			return;
		}

		const subject = `New Opnshelf feedback: ${category}`;
		const name = userDisplayName || userHandle;
		const pageLine = pageUrl ? `\nPage: ${pageUrl}` : "";

		try {
			const res = await fetch(CLOUDFLARE_SEND_URL(this.accountId), {
				method: "POST",
				headers: {
					Authorization: `Bearer ${this.apiToken}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					from: this.from,
					to,
					subject,
					text: `You received new feedback on Opnshelf.\n\nCategory: ${category}\nFrom: ${name} (@${userHandle})${pageLine}\n\nMessage:\n${message}`,
				}),
			});

			if (!res.ok) {
				const detail = await res.text().catch(() => "");
				this.logger.error(
					`Failed to send feedback email (HTTP ${res.status}): ${detail}`,
				);
			} else {
				this.logger.log(`Feedback email sent to ${to}`);
			}
		} catch (err) {
			this.logger.error("Exception sending feedback email", err);
		}
	}
}
