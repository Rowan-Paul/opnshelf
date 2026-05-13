import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateFeedbackDto } from "./dto/feedback.dto";

@Injectable()
export class FeedbackService {
	constructor(private prisma: PrismaService) {}

	async createFeedback(userDid: string, dto: CreateFeedbackDto) {
		return this.prisma.feedback.create({
			data: {
				userDid,
				category: dto.category,
				message: dto.message,
			},
		});
	}
}
