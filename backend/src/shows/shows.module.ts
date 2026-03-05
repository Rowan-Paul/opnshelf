import { forwardRef, Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { MoviesModule } from "../movies/movies.module";
import { PrismaModule } from "../prisma/prisma.module";
import { ShowsController } from "./shows.controller";
import { ShowsService } from "./shows.service";
import { ShowsTmdbService } from "./shows-tmdb.service";

@Module({
	imports: [PrismaModule, MoviesModule, forwardRef(() => AuthModule)],
	controllers: [ShowsController],
	providers: [ShowsService, ShowsTmdbService],
	exports: [ShowsService, ShowsTmdbService],
})
export class ShowsModule {}
