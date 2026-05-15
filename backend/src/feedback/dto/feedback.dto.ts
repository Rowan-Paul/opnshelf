import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, IsUrl, MaxLength } from "class-validator";

export class CreateFeedbackDto {
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
