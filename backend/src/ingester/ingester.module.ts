import { forwardRef, Module } from "@nestjs/common";
import { ListsModule } from "../lists/lists.module";
import { MoviesModule } from "../movies/movies.module";
import { PrismaModule } from "../prisma/prisma.module";
import { ShowsModule } from "../shows/shows.module";
import { IngesterService } from "./ingester.service";

@Module({
	imports: [
		PrismaModule,
		forwardRef(() => MoviesModule),
		forwardRef(() => ShowsModule),
		forwardRef(() => ListsModule),
	],
	providers: [IngesterService],
	exports: [IngesterService],
})
export class IngesterModule {}
