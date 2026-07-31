import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import {
	ApiBearerAuth,
	ApiOkResponse,
	ApiOperation,
	ApiTags,
	ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { AuthGuard } from "../auth/auth.guard";
import type { AuthenticatedRequest } from "../auth/types";
import {
	AtStoreReviewPromptDto,
	PublishAtStoreReviewDto,
	PublishAtStoreReviewResponseDto,
} from "./dto/atstore-review.dto";
import {
	AtStoreReviewsService,
	type ATSession,
} from "./atstore-reviews.service";

@ApiTags("at-store-reviews")
@Controller("at-store-review")
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class AtStoreReviewsController {
	constructor(private readonly atStoreReviewsService: AtStoreReviewsService) {}

	@Get("prompt")
	@ApiOperation({
		summary: "Check whether to show the AT Store review request",
	})
	@ApiOkResponse({ type: AtStoreReviewPromptDto })
	@ApiUnauthorizedResponse({ description: "Not authenticated" })
	getPrompt(@Req() req: AuthenticatedRequest): Promise<AtStoreReviewPromptDto> {
		return this.atStoreReviewsService.getPrompt(
			req.user.did,
			req.user.session as ATSession,
		);
	}

	@Post("dismiss")
	@ApiOperation({ summary: "Permanently dismiss the AT Store review request" })
	@ApiOkResponse({ schema: { example: { success: true } } })
	async dismiss(
		@Req() req: AuthenticatedRequest,
	): Promise<{ success: boolean }> {
		await this.atStoreReviewsService.dismiss(req.user.did);
		return { success: true };
	}

	@Post("publish")
	@ApiOperation({ summary: "Publish an AT Store review to the user's PDS" })
	@ApiOkResponse({ type: PublishAtStoreReviewResponseDto })
	publish(
		@Req() req: AuthenticatedRequest,
		@Body() dto: PublishAtStoreReviewDto,
	): Promise<PublishAtStoreReviewResponseDto> {
		return this.atStoreReviewsService.publish(
			req.user.did,
			req.user.session as ATSession,
			dto,
		);
	}
}
