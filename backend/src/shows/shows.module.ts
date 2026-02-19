import { forwardRef, Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { MoviesModule } from "../movies/movies.module";
import { PrismaModule } from "../prisma/prisma.module";
import { ShowsController } from "./shows.controller";
import { ShowsService } from "./shows.service";

@Module({
	imports: [PrismaModule, MoviesModule, forwardRef(() => AuthModule)],
	controllers: [ShowsController],
	providers: [ShowsService],
	exports: [ShowsService],
})
export class ShowsModule {}
