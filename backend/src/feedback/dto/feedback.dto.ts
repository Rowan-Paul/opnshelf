import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsString, MaxLength } from "class-validator";

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
