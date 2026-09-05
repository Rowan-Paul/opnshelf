import { forwardRef, Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ConfigModule } from "@nestjs/config";
import { ListsModule } from "../lists/lists.module";
import { MoviesModule } from "../movies/movies.module";
import { PrismaModule } from "../prisma/prisma.module";
import { ReviewsModule } from "../reviews/reviews.module";
import { ShelfModule } from "../shelf/shelf.module";
import { ShowsModule } from "../shows/shows.module";
import { SocialModule } from "../social/social.module";
import { BackgroundJobWorkerService } from "./background-job-worker.service";
import { ImportHistoryService } from "./import-history.service";
import { TraktImportJobStore } from "./import/trakt-import-job.store";
import { TraktImportWorker } from "./import/trakt-import-worker.service";
import { WatchImportWriter } from "./import/watch-import-writer.service";
import { ProfileService } from "./profile.service";
import { TraktApiClient } from "./trakt-api.client";
import { UserDeletionService } from "./user-deletion.service";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

@Module({
	imports: [
		ConfigModule,
		PrismaModule,
		ListsModule,
		MoviesModule,
		ShowsModule,
		SocialModule,
		ReviewsModule,
		ShelfModule,
		forwardRef(() => AuthModule),
	],
	controllers: [UsersController],
	providers: [
		UsersService,
		ImportHistoryService,
		TraktImportJobStore,
		WatchImportWriter,
		TraktImportWorker,
		TraktApiClient,
		BackgroundJobWorkerService,
		UserDeletionService,
		ProfileService,
	],
	exports: [UsersService, ProfileService],
})
export class UsersModule {}
