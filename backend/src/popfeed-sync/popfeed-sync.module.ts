import { forwardRef, Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { IntegrationsModule } from "../integrations/integrations.module";
import { MoviesModule } from "../movies/movies.module";
import { PrismaModule } from "../prisma/prisma.module";
import { ShowsModule } from "../shows/shows.module";
import { PopfeedMediaService } from "./popfeed-media";
import { PopfeedSyncClient } from "./popfeed-sync.client";
import { PopfeedSyncController } from "./popfeed-sync.controller";
import { PopfeedSyncService } from "./popfeed-sync.service";

@Module({
	imports: [
		PrismaModule,
		IntegrationsModule,
		MoviesModule,
		ShowsModule,
		forwardRef(() => AuthModule),
	],
	controllers: [PopfeedSyncController],
	providers: [PopfeedSyncClient, PopfeedMediaService, PopfeedSyncService],
	exports: [PopfeedSyncService],
})
export class PopfeedSyncModule {}
