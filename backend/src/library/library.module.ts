import { forwardRef, Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { MoviesModule } from "../movies/movies.module";
import { PrismaModule } from "../prisma/prisma.module";
import { ShowsModule } from "../shows/shows.module";
import { LibraryController } from "./library.controller";
import { LibraryService } from "./library.service";

@Module({
	imports: [
		PrismaModule,
		forwardRef(() => MoviesModule),
		forwardRef(() => ShowsModule),
		forwardRef(() => AuthModule),
	],
	controllers: [LibraryController],
	providers: [LibraryService],
	exports: [LibraryService],
})
export class LibraryModule {}
