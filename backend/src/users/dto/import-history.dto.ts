import { ApiProperty } from "@nestjs/swagger";

export class ImportBlueskyFollowsResponseDto {
	@ApiProperty({
		description: "Total Bluesky follows scanned from AppView",
	})
	scannedCount: number;

	@ApiProperty({
		description: "How many Bluesky follows already have Opnshelf accounts",
	})
	matchedCount: number;

	@ApiProperty({
		description: "How many new Opnshelf follows were created",
	})
	createdCount: number;

	@ApiProperty({
		description: "How many matched users were already followed",
	})
	alreadyFollowingCount: number;
}

export class CompleteOnboardingResponseDto {
	@ApiProperty({ description: "Timestamp when onboarding was completed" })
	onboardingCompletedAt: string;

	@ApiProperty({ default: false })
	needsOnboarding: boolean;
}
