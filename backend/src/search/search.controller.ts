import { Controller, Get, Query } from "@nestjs/common";
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import {
	type DiscoverQueryDto,
	UnifiedDiscoverResponseDto,
	UnifiedSearchResponseDto,
} from "./dto/search.dto";
import { SearchService } from "./search.service";

@ApiTags("search")
@Controller("search")
export class SearchController {
	constructor(private readonly searchService: SearchService) {}

	@Get("all")
	@ApiOperation({ summary: "Search movies and shows from TMDB" })
	@ApiQuery({ name: "query", required: true, description: "Search term" })
	@ApiQuery({ name: "page", required: false, description: "Page number" })
	@ApiResponse({ status: 200, type: UnifiedSearchResponseDto })
	async searchAll(@Query("query") query: string, @Query("page") page?: number) {
		return this.searchService.searchAll(query, page ?? 1);
	}

	@Get("discover")
	@ApiOperation({
		summary: "Discover popular movies and shows from TMDB",
	})
	@ApiQuery({ name: "sortBy", required: false, description: "Sort by" })
	@ApiQuery({ name: "page", required: false, description: "Page number" })
	@ApiQuery({ name: "year", required: false, description: "Year filter" })
	@ApiResponse({ status: 200, type: UnifiedDiscoverResponseDto })
	async discoverAll(@Query() query: DiscoverQueryDto) {
		return this.searchService.discoverAll(query);
	}
}
