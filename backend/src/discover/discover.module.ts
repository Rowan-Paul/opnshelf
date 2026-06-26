import { forwardRef, Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { MoviesModule } from "../movies/movies.module";
import { PrismaModule } from "../prisma/prisma.module";
import { ShowsModule } from "../shows/shows.module";
import { DiscoverController } from "./discover.controller";
import { DiscoverService } from "./discover.service";

@Module({
	imports: [
		PrismaModule,
		MoviesModule,
		ShowsModule,
		forwardRef(() => AuthModule),
	],
	controllers: [DiscoverController],
	providers: [DiscoverService],
})
export class DiscoverModule {}
