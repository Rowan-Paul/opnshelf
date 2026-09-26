import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { EmailModule } from "../email/email.module";
import { PrismaModule } from "../prisma/prisma.module";
import { MoviesModule } from "../movies/movies.module";
import { ShowsModule } from "../shows/shows.module";
import { NotificationWorkerService } from "./notification-worker.service";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";

@Module({
	imports: [AuthModule, EmailModule, PrismaModule, MoviesModule, ShowsModule],
	controllers: [NotificationsController],
	providers: [NotificationsService, NotificationWorkerService],
})
export class NotificationsModule {}
