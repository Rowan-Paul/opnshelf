import { ApiProperty } from "@nestjs/swagger";
import { IsDateString, ValidateIf } from "class-validator";

export class UpdateWatchDateDto {
	@ApiProperty({
		type: String,
		format: "date-time",
		nullable: true,
		description:
			"Watch date and time, or null for No date. Must not be in the future.",
	})
	@ValidateIf((_object, value) => value !== null)
	@IsDateString({ strict: true })
	watchedAt!: string | null;
}
