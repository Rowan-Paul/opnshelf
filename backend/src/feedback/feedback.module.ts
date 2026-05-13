import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { ResendModule } from "../resend/resend.module";
import { FeedbackController } from "./feedback.controller";
import { FeedbackService } from "./feedback.service";

@Module({
	imports: [PrismaModule, AuthModule, ResendModule],
	controllers: [FeedbackController],
	providers: [FeedbackService],
	exports: [FeedbackService],
})
export class FeedbackModule {}
