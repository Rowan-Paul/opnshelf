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
}
export class SyncActionDto {
	@ApiProperty({ enum: ["pause", "resume", "sync", "disconnect"] })
	@IsIn(["pause", "resume", "sync", "disconnect"])
	action: "pause" | "resume" | "sync" | "disconnect";
}
export class IntegrationCapabilitiesDto {
	@ApiProperty({
		description: "Record types this Integration can sync.",
		isArray: true,
		enum: [
			"watches",
			"ratings",
			"lists",
			"watchlist",
			"favorites",
			"notes",
			"library",
			"reviews",
		],
	})
	records: string[];
	@ApiProperty({ isArray: true, enum: ["inbound", "outbound", "both"] })
	directions: string[];
	@ApiProperty({
		enum: ["oauth", "repository"],
		description:
			"oauth returns a provider URL to open; repository connects in place.",
	})
	connect: string;
}
export class IntegrationConnectDto {
	@ApiProperty({ enum: ["web", "mobile"] })
	@IsIn(["web", "mobile"])
	platform: "web" | "mobile";
	@ApiPropertyOptional({
		enum: ["onboarding"],
		description:
			"Return to Onboarding after authorization instead of Integration management.",
	})
	@IsOptional()
	@IsIn(["onboarding"])
	returnTo?: "onboarding";
}
export class IntegrationConnectResultDto {
	@ApiPropertyOptional({ description: "Provider sign-in page to open." })
	url?: string;
	@ApiPropertyOptional({ description: "Where the provider returns the User." })
	returnUrl?: string;
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
	@ApiPropertyOptional({
		description:
			"Whether Opnshelf may write this provider's records in the User's repository. Omitted when the provider's own sign-in grants it.",
	})
	writeAccess?: boolean;
	@ApiPropertyOptional({ type: IntegrationCapabilitiesDto })
	capabilities?: IntegrationCapabilitiesDto;
}
export class SyncRecordDto {
	@ApiProperty() key: string;
	@ApiProperty() kind: string;
	@ApiProperty() mediaType: string;
	@ApiProperty({ type: String, nullable: true }) mediaId: string | null;
	@ApiProperty() title: string;
	@ApiProperty() season: number;
	@ApiProperty() episode: number;
	@ApiPropertyOptional() coordinatesUnknown?: boolean;
	@ApiProperty({ type: String, description: "Watch date, No date, or Rating" })
	displayValue: string;
}
export class SyncIssuesQueryDto extends PageQueryDto {
	@ApiPropertyOptional({ enum: ["attention", "ignored"] })
	@IsOptional()
	@IsIn(["attention", "ignored"])
	view?: "attention" | "ignored";
}

export class IntegrationResolveDto {
	@ApiProperty({
		description:
			"remote keeps the provider's version; opnshelf keeps Opnshelf's.",
		enum: [
			"remote",
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
		"remote",
		"opnshelf",
		"ignore",
		"undo",
		"retry",
		"link",
		"match",
		"separate",
	])
	action:
		| "remote"
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
			"The User checked the provider and confirmed the unacknowledged creation is missing before choosing a version.",
	})
	@IsOptional()
	@IsBoolean()
	confirmedRemoteMissing?: boolean;
}
export class IntegrationIssueDto {
	@ApiPropertyOptional({ enum: ["verify", "choose", "retry"] })
	recovery?: "verify" | "choose" | "retry";
	@ApiPropertyOptional({ enum: ["unknown", "missing", "present"] })
	remoteState?: "unknown" | "missing" | "present";
	@ApiProperty() id: string;
	@ApiProperty() kind: string;
	@ApiProperty() issue: string;
	@ApiProperty() ignored: boolean;
	@ApiPropertyOptional({ type: SyncRecordDto }) opnshelf?: SyncRecordDto;
	@ApiPropertyOptional({ type: SyncRecordDto }) remote?: SyncRecordDto;
	@ApiProperty({ type: [SyncRecordDto] }) candidates: SyncRecordDto[];
}
export class IntegrationIssuesDto extends PaginationMetaDto {
	@ApiProperty({ type: [IntegrationIssueDto] }) items: IntegrationIssueDto[];
}
