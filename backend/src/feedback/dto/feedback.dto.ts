import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
	IsIn,
	IsOptional,
	IsString,
	IsUrl,
	Matches,
	MaxLength,
} from "class-validator";

export class CreateFeedbackDto {
	@ApiPropertyOptional({
		description: "JPEG screenshot as base64, at most 60 KB",
		maxLength: 80000,
	})
	@IsOptional()
	@IsString()
	@MaxLength(80000)
	@Matches(/^\/9j\/[A-Za-z0-9+/]*={0,2}$/)
	screenshot?: string;

	@ApiProperty({
		description: "Feedback category",
		enum: ["bug", "feature_request"],
	})
	@IsString()
	@IsIn(["bug", "feature_request"])
	category: "bug" | "feature_request";

	@ApiProperty({ description: "Feedback message", maxLength: 5000 })
	@IsString()
	@MaxLength(5000)
	message: string;

	@ApiPropertyOptional({ description: "Page URL where feedback was submitted" })
	@IsOptional()
	@IsString()
	@IsUrl({ require_tld: false })
	@MaxLength(2048)
	pageUrl?: string;
}

export class FeedbackResponseDto {
	@ApiProperty()
	id: string;

	@ApiProperty()
	category: string;

	@ApiProperty()
	message: string;

	@ApiProperty()
	createdAt: string;
}
