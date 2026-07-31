import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { AtStoreReviewsController } from "./atstore-reviews.controller";
import { AtStoreReviewsService } from "./atstore-reviews.service";

@Module({
	imports: [PrismaModule, AuthModule],
	controllers: [AtStoreReviewsController],
	providers: [AtStoreReviewsService],
	exports: [AtStoreReviewsService],
})
export class AtStoreReviewsModule {}
