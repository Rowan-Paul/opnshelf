import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
	IsBoolean,
	IsIn,
	IsOptional,
	IsString,
	Matches,
	MaxLength,
} from "class-validator";
import { PaginationMetaDto } from "../common/pagination";
import { SyncRecordDto } from "../integrations/integration.dto";

// Provider-neutral DTOs moved to the shared Integration core (ADR 0051).
export {
	SyncActionDto,
	SyncIssuesQueryDto,
	SyncRecordDto,
	SyncSettingsDto,
	SyncStatusDto,
} from "../integrations/integration.dto";

export class SyncConnectDto {
	@ApiProperty({ enum: ["web", "mobile"] }) @IsIn(["web", "mobile"]) platform:
		| "web"
		| "mobile";
	@ApiPropertyOptional({
		enum: ["onboarding"],
		description:
			"Return to Onboarding after Trakt authorization instead of Trakt Sync.",
	})
	@IsOptional()
	@IsIn(["onboarding"])
	returnTo?: "onboarding";
}
export class SyncAuthorizeDto {
	@ApiProperty() url: string;
}
export class SyncResolveDto {
	@ApiProperty({
		enum: [
			"trakt",
			"opnshelf",
			"ignore",
			"undo",
			"retry",
			"link",
			"match",
			"separate",
		],
	})
	@IsIn([
		"trakt",
		"opnshelf",
		"ignore",
		"undo",
		"retry",
		"link",
		"match",
		"separate",
	])
	action:
		| "trakt"
		| "opnshelf"
		| "ignore"
		| "undo"
		| "retry"
		| "link"
		| "match"
		| "separate";
	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	@MaxLength(300)
	candidateKey?: string;
	@ApiPropertyOptional({ description: "TMDB movie or show ID" })
	@IsOptional()
	@Matches(/^[1-9]\d{0,9}$/)
	mediaId?: string;
	@ApiPropertyOptional() @IsOptional() @IsBoolean() allRatings?: boolean;
	@ApiPropertyOptional({
		description:
			"The User checked Trakt and confirmed the unacknowledged creation is missing before choosing a version.",
	})
	@IsOptional()
	@IsBoolean()
	confirmedTraktMissing?: boolean;
}
export class SyncIssueDto {
	@ApiPropertyOptional({ enum: ["verify", "choose", "retry"] })
	recovery?: "verify" | "choose" | "retry";
	@ApiPropertyOptional({ enum: ["unknown", "missing", "present"] })
	traktState?: "unknown" | "missing" | "present";
	@ApiProperty() id: string;
	@ApiProperty() kind: string;
	@ApiProperty() issue: string;
	@ApiProperty() ignored: boolean;
	@ApiPropertyOptional({ type: SyncRecordDto }) opnshelf?: SyncRecordDto;
	@ApiPropertyOptional({ type: SyncRecordDto }) trakt?: SyncRecordDto;
	@ApiProperty({ type: [SyncRecordDto] }) candidates: SyncRecordDto[];
}
export class SyncIssuesDto extends PaginationMetaDto {
	@ApiProperty({ type: [SyncIssueDto] }) items: SyncIssueDto[];
}

export class TraktMatchCandidateDto {
	@ApiProperty()
	tmdbId: string;

	@ApiProperty({ enum: ["movie", "show"] })
	mediaType: "movie" | "show";

	@ApiProperty()
	title: string;

	@ApiPropertyOptional()
	year?: number;

	@ApiPropertyOptional()
	posterPath?: string;

	@ApiPropertyOptional()
	overview?: string;
}
