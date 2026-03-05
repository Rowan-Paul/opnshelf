import { forwardRef, Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { ColorExtractionService } from "./color-extraction.service";
import { MoviesTmdbService } from "./movies-tmdb.service";
import { MoviesController } from "./movies.controller";
import { MoviesService } from "./movies.service";

@Module({
	imports: [PrismaModule, forwardRef(() => AuthModule)],
	controllers: [MoviesController],
	providers: [MoviesService, MoviesTmdbService, ColorExtractionService],
	exports: [MoviesService, MoviesTmdbService, ColorExtractionService],
})
export class MoviesModule {}
