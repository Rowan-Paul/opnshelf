import { PrivacyModule } from "../privacy/privacy.module";
import { forwardRef, Module } from "@nestjs/common";
import { PdsModule } from "../pds/pds.module";
import { AuthModule } from "../auth/auth.module";
import { ListsModule } from "../lists/lists.module";
import { MoviesModule } from "../movies/movies.module";
import { PrismaModule } from "../prisma/prisma.module";
import { ReviewsModule } from "../reviews/reviews.module";
import { ShelfModule } from "../shelf/shelf.module";
import { ShowsModule } from "../shows/shows.module";
import { SocialModule } from "../social/social.module";
import { BackgroundJobWorkerService } from "./background-job-worker.service";
import { ProfileService } from "./profile.service";
import { ReleaseNotesController } from "./release-notes.controller";
import { UserDeletionService } from "./user-deletion.service";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";
import { TraktSyncModule } from "../trakt-sync/trakt-sync.module";

@Module({
	imports: [
		forwardRef(() => PrivacyModule),
		PdsModule,
		PrismaModule,
		TraktSyncModule,
		ListsModule,
		MoviesModule,
		ShowsModule,
		SocialModule,
		ReviewsModule,
		ShelfModule,
		forwardRef(() => AuthModule),
	],
	controllers: [UsersController, ReleaseNotesController],
	providers: [
		UsersService,
		BackgroundJobWorkerService,
		UserDeletionService,
		ProfileService,
	],
	exports: [UsersService, ProfileService],
})
export class UsersModule {}
