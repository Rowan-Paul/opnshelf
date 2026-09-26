import { Module } from "@nestjs/common";
import { StreamingServicesController } from "./streaming-services.controller";
import { StreamingServicesService } from "./streaming-services.service";

/** Streaming Service catalogue for the My Services picker (issue #363). */
@Module({
	controllers: [StreamingServicesController],
	providers: [StreamingServicesService],
	exports: [StreamingServicesService],
})
export class StreamingServicesModule {}
