import { ApiProperty } from "@nestjs/swagger";
import { UnifiedSearchResultDto } from "../../search/dto/search.dto";

export class DiscoverSectionResponseDto {
	@ApiProperty({ type: [UnifiedSearchResultDto] })
	items: UnifiedSearchResultDto[];
}

export class BecauseYouWatchedRowDto {
	@ApiProperty()
	seedId: number;

	@ApiProperty({ enum: ["movie", "tv"] })
	seedMediaType: "movie" | "tv";

	@ApiProperty()
	seedTitle: string;

	@ApiProperty({ type: [UnifiedSearchResultDto] })
	items: UnifiedSearchResultDto[];
}

export class BecauseYouWatchedResponseDto {
	@ApiProperty({ type: [BecauseYouWatchedRowDto] })
	rows: BecauseYouWatchedRowDto[];
}

export class PopularOnYourServicesRowDto extends DiscoverSectionResponseDto {
	@ApiProperty()
	serviceId: number;

	@ApiProperty()
	serviceName: string;
}

export class PopularOnYourServicesResponseDto {
	@ApiProperty({ type: [PopularOnYourServicesRowDto] })
	rows: PopularOnYourServicesRowDto[];
}
