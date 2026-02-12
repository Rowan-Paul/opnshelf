import { forwardRef, Module } from "@nestjs/common";
import { MoviesModule } from "../movies/movies.module";
import { PrismaModule } from "../prisma/prisma.module";
import { IngesterService } from "./ingester.service";

@Module({
	imports: [PrismaModule, forwardRef(() => MoviesModule)],
	providers: [IngesterService],
	exports: [IngesterService],
})
export class IngesterModule {}
