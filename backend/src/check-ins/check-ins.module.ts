import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { MoviesModule } from "../movies/movies.module";
import { PrismaModule } from "../prisma/prisma.module";
import { ShowsModule } from "../shows/shows.module";
import { CheckInsController } from "./check-ins.controller";
import { CheckInsService } from "./check-ins.service";

@Module({
	imports: [AuthModule, MoviesModule, PrismaModule, ShowsModule],
	controllers: [CheckInsController],
	providers: [CheckInsService],
})
export class CheckInsModule {}
