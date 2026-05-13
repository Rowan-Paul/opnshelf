import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Resend } from "resend";

@Injectable()
export class ResendService {
	private readonly resend: Resend;
	private readonly logger = new Logger(ResendService.name);
	private readonly from: string;

	constructor(private readonly config: ConfigService) {
		const apiKey = this.config.get<string>("RESEND_API_KEY");
		this.from = "OpnShelf <opnshelf@rowanpaulflynn.dev>";
		this.resend = new Resend(apiKey);
	}

	async sendFeedbackNotification(params: {
		to: string;
		category: string;
		message: string;
		userHandle: string;
		userDisplayName?: string | null;
	}) {
		const { to, category, message, userHandle, userDisplayName } = params;
		const subject = `New OpnShelf feedback: ${category}`;
		const name = userDisplayName || userHandle;

		try {
			const { error } = await this.resend.emails.send({
				from: this.from,
				to,
				subject,
				text: `You received new feedback on OpnShelf.\n\nCategory: ${category}\nFrom: ${name} (@${userHandle})\n\nMessage:\n${message}`,
			});

			if (error) {
				this.logger.error("Failed to send feedback email", error);
			} else {
				this.logger.log(`Feedback email sent to ${to}`);
			}
		} catch (err) {
			this.logger.error("Exception sending feedback email", err);
		}
	}
}
