import { Controller, Get, Header, Query } from "@nestjs/common";
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import { PUBLIC_CATALOGUE_CACHE_CONTROL } from "../common/cache-control";
import { StreamingServicesResponseDto } from "./dto/streaming-service.dto";
import { StreamingServicesService } from "./streaming-services.service";

@ApiTags("streaming-services")
@Controller("streaming-services")
export class StreamingServicesController {
	constructor(private readonly streamingServices: StreamingServicesService) {}

	@Get()
	@Header("Cache-Control", PUBLIC_CATALOGUE_CACHE_CONTROL)
	@ApiOperation({
		summary:
			"List the Streaming Services available in a watch country, ordered by prominence",
	})
	@ApiQuery({
		name: "country",
		required: false,
		description:
			"ISO 3166-1 alpha-2 country code (e.g. US, NL); defaults to US",
	})
	@ApiResponse({ status: 200, type: StreamingServicesResponseDto })
	async list(
		@Query("country") country?: string,
	): Promise<StreamingServicesResponseDto> {
		return this.streamingServices.listForCountry(country ?? "US");
	}
}
