import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
import {
	ApiBearerAuth,
	ApiOkResponse,
	ApiOperation,
	ApiTags,
	ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { AuthGuard } from "../auth/auth.guard";
import type { AuthenticatedRequest } from "../auth/types";
import { CreateFeedbackDto, FeedbackResponseDto } from "./dto/feedback.dto";
import { FeedbackService } from "./feedback.service";

@ApiTags("feedback")
@Controller("feedback")
export class FeedbackController {
	constructor(private readonly feedbackService: FeedbackService) {}

	@Post()
	@UseGuards(AuthGuard)
	@ApiBearerAuth()
	@ApiOperation({ summary: "Submit user feedback" })
	@ApiOkResponse({
		description: "Feedback submitted",
		type: FeedbackResponseDto,
	})
	@ApiUnauthorizedResponse({ description: "Not authenticated" })
	async createFeedback(
		@Req() req: AuthenticatedRequest,
		@Body() dto: CreateFeedbackDto,
	): Promise<FeedbackResponseDto> {
		const feedback = await this.feedbackService.createFeedback(
			req.user.did,
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
