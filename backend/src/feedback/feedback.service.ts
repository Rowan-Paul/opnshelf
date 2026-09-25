import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateFeedbackDto } from "./dto/feedback.dto";
import { FeedbackIssuesService } from "./feedback-issues.service";

@Injectable()
export class FeedbackService {
	constructor(
		private prisma: PrismaService,
		private issues: FeedbackIssuesService,
	) {}

	async createFeedback(userDid: string | null, dto: CreateFeedbackDto) {
		const feedback = await this.prisma.feedback.create({
			data: {
				userDid,
				category: dto.category,
				message: dto.message,
				pageUrl: dto.pageUrl,
			},
		});

		await this.issues.createIssue(feedback.id, dto);

		return feedback;
	}
}
