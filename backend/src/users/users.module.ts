import { forwardRef, Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ConfigModule } from "@nestjs/config";
import { ListsModule } from "../lists/lists.module";
import { MoviesModule } from "../movies/movies.module";
import { PrismaModule } from "../prisma/prisma.module";
import { ShowsModule } from "../shows/shows.module";
import { SocialModule } from "../social/social.module";
import { BackgroundJobWorkerService } from "./background-job-worker.service";
import { ImportHistoryService } from "./import-history.service";
import { ProfileService } from "./profile.service";
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
		forwardRef(() => AuthModule),
	],
	controllers: [UsersController],
	providers: [
		UsersService,
		ImportHistoryService,
		BackgroundJobWorkerService,
		UserDeletionService,
		ProfileService,
	],
	exports: [UsersService, ProfileService],
})
export class UsersModule {}
