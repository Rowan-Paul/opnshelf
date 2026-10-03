import { ApiProperty } from "@nestjs/swagger";
import { IsDateString } from "class-validator";

export class ReleaseNotesReadStateDto {
	@ApiProperty({
		description: "Release Notes published through this UTC timestamp are read",
		format: "date-time",
	})
	readThrough!: string;
}
export class MarkReleaseNotesReadDto {
	@ApiProperty({
		description: "Publication timestamp of the newest entry actually displayed",
		format: "date-time",
	})
	@IsDateString({ strict: true })
	readThrough!: string;
}
