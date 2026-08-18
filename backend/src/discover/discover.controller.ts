import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "../auth/auth.guard";
import type { AuthenticatedRequest } from "../auth/types";
import {
	BecauseYouWatchedResponseDto,
	DiscoverSectionResponseDto,
} from "./dto/discover.dto";
import { DiscoverService } from "./discover.service";

@ApiTags("discover")
@Controller("discover")
export class DiscoverController {
	constructor(private readonly discoverService: DiscoverService) {}

	@Get("trending")
	@ApiOperation({ summary: "Trending movies and shows this week" })
	@ApiResponse({ status: 200, type: DiscoverSectionResponseDto })
	async trending() {
		return this.discoverService.trending();
	}

	@Get("onboarding")
	@ApiOperation({ summary: "Movies and shows for the onboarding swipe deck" })
	@ApiResponse({ status: 200, type: DiscoverSectionResponseDto })
	async onboarding() {
		return this.discoverService.onboarding();
	}

	@Get("from-follows")
	@UseGuards(AuthGuard)
	@ApiOperation({
		summary: "Titles the people you follow watched or rated highly",
	})
	@ApiResponse({ status: 200, type: DiscoverSectionResponseDto })
	async fromFollows(@Req() req: AuthenticatedRequest) {
		return this.discoverService.fromFollows(req.user.did);
	}

	@Get("because-you-watched")
	@UseGuards(AuthGuard)
	@ApiOperation({
		summary: "Recommendation rows seeded from your recent watches",
	})
	@ApiResponse({ status: 200, type: BecauseYouWatchedResponseDto })
	async becauseYouWatched(@Req() req: AuthenticatedRequest) {
		return this.discoverService.becauseYouWatched(req.user.did);
	}
}
