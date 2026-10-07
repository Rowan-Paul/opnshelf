import {
	Body,
	Catch,
	UseFilters,
	type ArgumentsHost,
	type ExceptionFilter,
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
import type { Response } from "express";
import { WatchMigrationPdsError } from "./watch-migration-pds";
import { WatchPrivacyService } from "./watch-privacy.service";

@Catch(WatchMigrationPdsError)
class WatchPrivacyPdsFilter implements ExceptionFilter {
	catch(error: WatchMigrationPdsError, host: ArgumentsHost) {
		const messages: Record<string, string> = {
			ConditionalDeleteUnsupported:
				"Your PDS needs an update before Watches can safely change privacy.",
			InsufficientScope:
				"Reconnect Watch access before changing or syncing private Watches.",
			SpaceNotPrivate:
				"Your Watch Space is shared. Restore owner-only access before continuing.",
			SpaceNotFound:
				"Your private Watch Space could not be found. Reconnect Watch access and try again.",
		};
		host
			.switchToHttp()
			.getResponse<Response>()
			.status(error.status >= 400 && error.status < 500 ? error.status : 502)
			.json({
				message:
					messages[error.code] ??
					"The PDS could not complete this Watch request. Try again; an interrupted privacy change can be resumed.",
			});
	}
}

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
