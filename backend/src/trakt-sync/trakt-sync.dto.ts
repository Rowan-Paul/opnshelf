import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
	IsBoolean,
	IsIn,
	IsOptional,
	IsString,
	Matches,
	MaxLength,
} from "class-validator";
import { PageQueryDto, PaginationMetaDto } from "../common/pagination";

export class SyncSettingsDto {
	@ApiProperty({ enum: ["inbound", "outbound", "both"] })
	@IsIn(["inbound", "outbound", "both"])
	direction: "inbound" | "outbound" | "both";
	@ApiProperty() @IsBoolean() watches: boolean;
	@ApiProperty() @IsBoolean() ratings: boolean;
	@ApiPropertyOptional({ default: false })
	@IsOptional()
	@IsBoolean()
	lists?: boolean;
	@ApiPropertyOptional({ default: false })
	@IsOptional()
	@IsBoolean()
	watchlist?: boolean;
	@ApiPropertyOptional({ default: false })
	@IsOptional()
	@IsBoolean()
	favorites?: boolean;
	@ApiPropertyOptional({ default: false })
	@IsOptional()
	@IsBoolean()
	listPublicationConsent?: boolean;
	@ApiPropertyOptional({ default: false })
	@IsOptional()
	@IsBoolean()
	notes?: boolean;
	@ApiPropertyOptional({ default: false })
	@IsOptional()
	@IsBoolean()
	library?: boolean;
	@ApiPropertyOptional({ default: false })
	@IsOptional()
	@IsBoolean()
	reviews?: boolean;
	@ApiPropertyOptional({ default: false })
	@IsOptional()
	@IsBoolean()
	contentPublicationConsent?: boolean;
	@ApiProperty({ enum: ["all", "future"] })
	@IsIn(["all", "future"])
	historyScope: "all" | "future";
	@ApiProperty() @IsBoolean() publicationConsent: boolean;
	@ApiPropertyOptional({ default: false })
	@IsOptional()
	@IsBoolean()
	handoffImport?: boolean;
}
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
export class SyncActionDto {
	@ApiProperty({ enum: ["pause", "resume", "sync", "disconnect"] })
	@IsIn(["pause", "resume", "sync", "disconnect"])
	action: "pause" | "resume" | "sync" | "disconnect";
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
export class SyncStatusDto {
	@ApiPropertyOptional({ enum: ["idle", "queued", "running", "waiting"] })
	syncState?: "idle" | "queued" | "running" | "waiting";
	@ApiPropertyOptional() nextCheckAt?: string;
	@ApiProperty() configured: boolean;
	@ApiProperty({
		enum: ["disconnected", "paused", "preparing", "active", "reconnect"],
	})
	status: string;
	@ApiPropertyOptional() username?: string;
	@ApiProperty({ enum: ["inbound", "outbound", "both"] }) direction: string;
	@ApiProperty() watches: boolean;
	@ApiProperty() ratings: boolean;
	@ApiPropertyOptional() lists?: boolean;
	@ApiPropertyOptional() watchlist?: boolean;
	@ApiPropertyOptional() favorites?: boolean;
	@ApiPropertyOptional() notes?: boolean;
	@ApiPropertyOptional() library?: boolean;
	@ApiPropertyOptional() reviews?: boolean;
	@ApiPropertyOptional() contentPublicationConsent?: boolean;

	@ApiPropertyOptional() listPublicationConsent?: boolean;
	@ApiProperty({ enum: ["all", "future"] }) historyScope: string;
	@ApiProperty() publicationConsent: boolean;
	@ApiPropertyOptional() lastSuccessAt?: string;
	@ApiPropertyOptional() lastError?: string;
	@ApiProperty({
		description: "Records still waiting to transfer while sync catches up",
	})
	remaining: number;
	@ApiPropertyOptional({
		description: "Catch-up progress (0–100) while records remain",
	})
	progress?: number;
	@ApiProperty() needsAttention: number;
	@ApiProperty() ignored: number;
	@ApiPropertyOptional() importStatus?: string;
}
export class SyncRecordDto {
	@ApiProperty() key: string;
	@ApiProperty() kind: string;
	@ApiProperty() mediaType: string;
	@ApiProperty({ type: String, nullable: true }) mediaId: string | null;
	@ApiProperty() title: string;
	@ApiProperty() season: number;
	@ApiProperty() episode: number;
	@ApiProperty({ type: String, description: "Watch date, No date, or Rating" })
	displayValue: string;
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
export class SyncIssuesQueryDto extends PageQueryDto {
	@ApiPropertyOptional({ enum: ["attention", "ignored"] })
	@IsOptional()
	@IsIn(["attention", "ignored"])
	view?: "attention" | "ignored";
}
export class SyncIssuesDto extends PaginationMetaDto {
	@ApiProperty({ type: [SyncIssueDto] }) items: SyncIssueDto[];
}
