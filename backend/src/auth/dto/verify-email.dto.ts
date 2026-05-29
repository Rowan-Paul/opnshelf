import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength, MinLength } from "class-validator";

export class VerifyEmailDto {
	@ApiProperty({
		description: "The verification code from the signup email",
	})
	@IsString()
	@MinLength(1)
	@MaxLength(512)
	code: string;
}

export class VerifyEmailResponseDto {
	@ApiProperty({ description: "Whether the account is now verified" })
	verified: boolean;
}
