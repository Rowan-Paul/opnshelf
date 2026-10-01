import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { MoviesModule } from "../movies/movies.module";
import { ShowsModule } from "../shows/shows.module";
import { WatchPickerController } from "./watch-picker.controller";
import { WatchPickerService } from "./watch-picker.service";
@Module({
	imports: [AuthModule, PrismaModule, MoviesModule, ShowsModule],
	controllers: [WatchPickerController],
	providers: [WatchPickerService],
})
export class WatchPickerModule {}
