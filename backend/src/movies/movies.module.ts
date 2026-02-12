import { forwardRef, Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { ColorExtractionService } from "./color-extraction.service";
import { MoviesController } from "./movies.controller";
import { MoviesService } from "./movies.service";

@Module({
	imports: [PrismaModule, forwardRef(() => AuthModule)],
	controllers: [MoviesController],
	providers: [MoviesService, ColorExtractionService],
	exports: [MoviesService, ColorExtractionService],
})
export class MoviesModule {}
