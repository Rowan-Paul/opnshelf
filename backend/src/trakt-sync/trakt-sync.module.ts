import { ListsModule } from "../lists/lists.module";
import { LocalSyncLists } from "./local-lists.service";
import { forwardRef, Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { MoviesModule } from "../movies/movies.module";
import { ShowsModule } from "../shows/shows.module";
import { RatingsModule } from "../ratings/ratings.module";
import { PrismaModule } from "../prisma/prisma.module";
import { LocalSyncRecords } from "./local-records.service";
import { TraktSyncClient } from "./trakt-sync.client";
import { TraktSyncController } from "./trakt-sync.controller";
import { TraktSyncService } from "./trakt-sync.service";

@Module({
	imports: [
		PrismaModule,
		ListsModule,
		MoviesModule,
		ShowsModule,
		RatingsModule,
		forwardRef(() => AuthModule),
	],
	controllers: [TraktSyncController],
	providers: [
		LocalSyncLists,
		TraktSyncClient,
		LocalSyncRecords,
		TraktSyncService,
	],
	exports: [TraktSyncService],
})
export class TraktSyncModule {}
