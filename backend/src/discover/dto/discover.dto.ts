import { ApiProperty } from "@nestjs/swagger";
import { UnifiedSearchResultDto } from "../../search/dto/search.dto";

export class DiscoverSectionResponseDto {
	@ApiProperty({ type: [UnifiedSearchResultDto] })
	results: UnifiedSearchResultDto[];
}

export class BecauseYouWatchedRowDto {
	@ApiProperty()
	seedId: number;

	@ApiProperty({ enum: ["movie", "tv"] })
	seedMediaType: "movie" | "tv";

	@ApiProperty()
	seedTitle: string;

	@ApiProperty({ type: [UnifiedSearchResultDto] })
	results: UnifiedSearchResultDto[];
}

export class BecauseYouWatchedResponseDto {
	@ApiProperty({ type: [BecauseYouWatchedRowDto] })
	rows: BecauseYouWatchedRowDto[];
}
