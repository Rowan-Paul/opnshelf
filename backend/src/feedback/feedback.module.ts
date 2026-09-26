import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { FeedbackIssuesService } from "./feedback-issues.service";
import { FeedbackController } from "./feedback.controller";
import { FeedbackService } from "./feedback.service";

@Module({
	imports: [PrismaModule, AuthModule],
	controllers: [FeedbackController],
	providers: [FeedbackService, FeedbackIssuesService],
	exports: [FeedbackService],
})
export class FeedbackModule {}
