import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateFeedbackDto } from "./dto/feedback.dto";
import { FeedbackIssuesService } from "./feedback-issues.service";

@Injectable()
export class FeedbackService {
	constructor(
		private prisma: PrismaService,
		private issues: FeedbackIssuesService,
	) {}

	async getScreenshot(id: string): Promise<Buffer> {
		const feedback = await this.prisma.feedback.findUnique({
			where: { id },
			select: { screenshot: true },
		});
		if (!feedback?.screenshot) throw new NotFoundException();
		return Buffer.from(feedback.screenshot, "base64");
	}

	async createFeedback(userDid: string | null, dto: CreateFeedbackDto) {
		const feedback = await this.prisma.feedback.create({
			data: {
				userDid,
				category: dto.category,
				message: dto.message,
				pageUrl: dto.pageUrl,
				screenshot: dto.screenshot,
			},
		});

		await this.issues.createIssue(feedback.id, dto);

		return feedback;
	}
}
