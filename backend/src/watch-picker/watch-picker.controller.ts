import { Controller, Get, Header, Query, Req, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "../auth/auth.guard";
import type { AuthenticatedRequest } from "../auth/types";
import {
	WatchPickerQueryDto,
	WatchPickerResponseDto,
} from "./watch-picker.dto";
import { WatchPickerService } from "./watch-picker.service";
@ApiTags("watch-picker")
@Controller("watch-picker")
@UseGuards(AuthGuard)
export class WatchPickerController {
	constructor(private readonly picker: WatchPickerService) {}
	@Get()
	@Header("Cache-Control", "private, no-store")
	@ApiOperation({
		summary: "Eligible watching sessions from your Up Next and watchlist",
	})
	@ApiResponse({ status: 200, type: WatchPickerResponseDto })
	get(@Req() req: AuthenticatedRequest, @Query() query: WatchPickerQueryDto) {
		return this.picker.get(req.user.did, query);
	}
}
