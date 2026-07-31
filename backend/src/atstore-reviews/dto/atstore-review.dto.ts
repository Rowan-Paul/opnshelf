import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
	IsInt,
	IsOptional,
	IsString,
	Max,
	MaxLength,
	Min,
} from "class-validator";

export class PublishAtStoreReviewDto {
	@ApiProperty({ description: "AT Store rating from 1 through 5" })
	@IsInt()
	@Min(1)
	@Max(5)
	rating!: number;

	@ApiPropertyOptional({
		description: "Optional plain-text AT Store review",
		maxLength: 8000,
	})
	@IsOptional()
	@IsString()
	@MaxLength(8000)
	text?: string;
}

export class AtStoreReviewPromptDto {
	@ApiProperty({
		description:
			"Whether the Home review request should be shown for this visit. False also covers a failed external preflight.",
	})
	eligible!: boolean;
}

export class PublishAtStoreReviewResponseDto {
	@ApiProperty({ description: "AT URI of the review record" })
	uri!: string;
}
