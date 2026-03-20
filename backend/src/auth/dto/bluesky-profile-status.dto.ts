import { ApiProperty } from "@nestjs/swagger";

export class BlueskyProfileStatusDto {
	@ApiProperty({
		description: "Whether this DID resolves to a real Bluesky/AppView profile",
	})
	hasBlueskyProfile: boolean;
}
