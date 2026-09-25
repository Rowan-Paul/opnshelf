import { ApiProperty } from "@nestjs/swagger";

/**
 * A Streaming Service as TMDB/JustWatch lists it for one watch country.
 * The id is TMDB's watch-provider id, which is what My Services stores.
 */
export class StreamingServiceDto {
	@ApiProperty({ description: "TMDB watch-provider id" })
	id!: number;

	@ApiProperty({ description: "Display name, e.g. Netflix" })
	name!: string;

	@ApiProperty({
		description: "Absolute URL of the service logo, or null when TMDB has none",
		nullable: true,
		type: String,
	})
	logoUrl!: string | null;

	@ApiProperty({
		description:
			"TMDB display priority within the requested country; lower is more prominent",
	})
	displayPriority!: number;
}

export class StreamingServicesResponseDto {
	@ApiProperty({ description: "ISO 3166-1 alpha-2 country the list is for" })
	country!: string;

	@ApiProperty({ type: [StreamingServiceDto] })
	services!: StreamingServiceDto[];
}
