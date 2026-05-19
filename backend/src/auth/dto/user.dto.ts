import { ApiProperty } from "@nestjs/swagger";

export class UserDto {
	@ApiProperty({ description: "User DID (decentralized identifier)" })
	did: string;

	@ApiProperty({ description: "User handle (e.g., user.bsky.social)" })
	handle: string;

	@ApiProperty({ description: "Display name", nullable: true, type: String })
	displayName: string | null;

	@ApiProperty({
		description: "OpnShelf profile avatar URL",
		nullable: true,
		type: String,
	})
	avatar: string | null;

	@ApiProperty({
		description: "When onboarding was completed",
		nullable: true,
		type: String,
	})
	onboardingCompletedAt: string | null;

	@ApiProperty({ description: "Whether this user should complete onboarding" })
	needsOnboarding: boolean;

	@ApiProperty({
		description: "Bluesky profile URL",
		nullable: true,
		type: String,
	})
	blueskyProfileUrl: string | null;

	@ApiProperty({
		description: "Tangled profile URL",
		nullable: true,
		type: String,
	})
	tangledProfileUrl: string | null;

	@ApiProperty({
		description: "Whether Bluesky link is shown on public profile",
	})
	showBlueskyOnProfile: boolean;

	@ApiProperty({
		description: "Whether Tangled link is shown on public profile",
	})
	showTangledOnProfile: boolean;
}
