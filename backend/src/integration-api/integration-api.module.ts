import { forwardRef, Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { BingersSyncModule } from "../bingers-sync/bingers-sync.module";
import { PopfeedSyncModule } from "../popfeed-sync/popfeed-sync.module";
import { TraktSyncModule } from "../trakt-sync/trakt-sync.module";
import { IntegrationApiController } from "./integration-api.controller";

/** The shared HTTP API over every Integration provider (ADR 0051). */
@Module({
	imports: [
		TraktSyncModule,
		PopfeedSyncModule,
		BingersSyncModule,
		forwardRef(() => AuthModule),
	],
	controllers: [IntegrationApiController],
})
export class IntegrationApiModule {}
