import { ApiProperty } from "@nestjs/swagger";

export class UserDto {
	@ApiProperty({ description: "User DID (decentralized identifier)" })
	did: string;

	@ApiProperty({ description: "User handle (e.g., user.bsky.social)" })
	handle: string;

	@ApiProperty({ description: "Display name", nullable: true })
	displayName: string | null;

	@ApiProperty({ description: "Avatar URL", nullable: true })
	avatar: string | null;
}
