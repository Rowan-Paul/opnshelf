import { forwardRef, Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { MoviesModule } from "../movies/movies.module";
import { PrismaModule } from "../prisma/prisma.module";
import { ShowsModule } from "../shows/shows.module";
import { ImportHistoryService } from "./import-history.service";
import { UserDeletionService } from "./user-deletion.service";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

@Module({
	imports: [
		PrismaModule,
		MoviesModule,
		ShowsModule,
		forwardRef(() => AuthModule),
	],
	controllers: [UsersController],
	providers: [UsersService, ImportHistoryService, UserDeletionService],
	exports: [UsersService],
})
export class UsersModule {}
