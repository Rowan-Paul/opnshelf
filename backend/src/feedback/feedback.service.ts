import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EmailService } from "../email/email.service";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateFeedbackDto } from "./dto/feedback.dto";

@Injectable()
export class FeedbackService {
	constructor(
		private prisma: PrismaService,
		private email: EmailService,
		private config: ConfigService,
	) {}

	async createFeedback(userDid: string, dto: CreateFeedbackDto) {
		const feedback = await this.prisma.feedback.create({
			data: {
				userDid,
				category: dto.category,
				message: dto.message,
				pageUrl: dto.pageUrl,
			},
		});

		const user = await this.prisma.user.findUnique({
			where: { did: userDid },
			select: { handle: true, displayName: true },
		});

		const notificationEmail = this.config.get<string>(
			"FEEDBACK_NOTIFICATION_EMAIL",
		);
		if (notificationEmail && user) {
			await this.email.sendFeedbackNotification({
				to: notificationEmail,
				category: dto.category,
				message: dto.message,
				userHandle: user.handle,
				userDisplayName: user.displayName,
				pageUrl: dto.pageUrl,
			});
		}

		return feedback;
	}
}
