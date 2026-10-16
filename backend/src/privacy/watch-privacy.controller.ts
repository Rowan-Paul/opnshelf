import {
	Body,
	UseFilters,
	Controller,
	Get,
	Header,
	Post,
	Req,
	UseGuards,
} from "@nestjs/common";
import { ApiProperty, ApiResponse, ApiTags } from "@nestjs/swagger";
import { IsBoolean, IsIn, IsOptional } from "class-validator";
import { AuthGuard } from "../auth/auth.guard";
import type { AuthenticatedRequest } from "../auth/types";
import { WatchPrivacyPdsFilter } from "./privacy-pds.filter";
import { WatchPrivacyService } from "./watch-privacy.service";

export class WatchPrivacyChangeDto {
	@ApiProperty({ enum: ["public", "private"] })
	@IsIn(["public", "private"])
	visibility!: "public" | "private";
	@ApiProperty({
		required: false,
		description: "Explicit consent to publish all Watches",
	})
	@IsOptional()
	@IsBoolean()
	publicationConfirmed?: boolean;
}
export class WatchPrivacyMigrationDto {
	@ApiProperty() id!: string;
	@ApiProperty({ enum: ["public", "private"] }) target!: "public" | "private";
	@ApiProperty() status!: string;
	@ApiProperty() copied!: number;
	@ApiProperty({ type: String, nullable: true }) error!: string | null;
}
export class WatchPrivacyStatusDto {
	@ApiProperty({ enum: ["public", "private"] }) visibility!:
		| "public"
		| "private";
	@ApiProperty() connected!: boolean;
	@ApiProperty({ type: String, nullable: true }) lastSyncedAt!: string | null;
	@ApiProperty({ type: String, nullable: true }) syncError!: string | null;
	@ApiProperty({ type: WatchPrivacyMigrationDto, nullable: true })
	migration!: WatchPrivacyMigrationDto | null;
}
@ApiTags("privacy")
@Controller("users/me/watch-privacy")
@UseGuards(AuthGuard)
@UseFilters(WatchPrivacyPdsFilter)
export class WatchPrivacyController {
	constructor(private readonly privacy: WatchPrivacyService) {}
	@Get()
	@Header("Cache-Control", "private, no-store")
	@ApiResponse({ status: 200, type: WatchPrivacyStatusDto })
	status(@Req() req: AuthenticatedRequest) {
		return this.privacy.status(req.user.did, req.user.session);
	}
	@Post()
	@ApiResponse({ status: 201, type: WatchPrivacyStatusDto })
	change(
		@Req() req: AuthenticatedRequest,
		@Body() body: WatchPrivacyChangeDto,
	) {
		return this.privacy.start(
			req.user.did,
			req.user.session,
			body.visibility,
			body.publicationConfirmed === true,
		);
	}
	@Post("retry")
	@ApiResponse({ status: 201, type: WatchPrivacyStatusDto })
	retry(@Req() req: AuthenticatedRequest) {
		return this.privacy.retry(req.user.did, req.user.session);
	}
	@Post("sync")
	@ApiResponse({ status: 201, type: WatchPrivacyStatusDto })
	sync(@Req() req: AuthenticatedRequest) {
		return this.privacy.sync(req.user.did, req.user.session);
	}
}
