import { forwardRef, Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { MoviesModule } from "../movies/movies.module";
import { PrismaModule } from "../prisma/prisma.module";
import { ListsController } from "./lists.controller";
import { ListsService } from "./lists.service";

@Module({
	imports: [
		PrismaModule,
		forwardRef(() => MoviesModule),
		forwardRef(() => AuthModule),
	],
	controllers: [ListsController],
	providers: [ListsService],
	exports: [ListsService],
})
export class ListsModule {}
