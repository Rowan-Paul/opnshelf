import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { OptionalAuthGuard } from "../auth/optional-auth.guard";
import type { AuthenticatedRequest } from "../auth/types";
import { CreateFeedbackDto, FeedbackResponseDto } from "./dto/feedback.dto";
import { FeedbackService } from "./feedback.service";

@ApiTags("feedback")
@Controller("feedback")
export class FeedbackController {
	constructor(private readonly feedbackService: FeedbackService) {}

	@Post()
	@UseGuards(OptionalAuthGuard)
	@ApiOperation({ summary: "Submit feedback with or without a session" })
	@ApiOkResponse({
		description: "Feedback submitted",
		type: FeedbackResponseDto,
	})
	async createFeedback(
		@Req() req: Partial<AuthenticatedRequest>,
		@Body() dto: CreateFeedbackDto,
	): Promise<FeedbackResponseDto> {
		const feedback = await this.feedbackService.createFeedback(
			req.user?.did ?? null,
			dto,
		);

		return {
			id: feedback.id,
			category: feedback.category,
			message: feedback.message,
			createdAt: feedback.createdAt.toISOString(),
		};
	}
}
