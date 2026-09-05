import { forwardRef, Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { BlogMirrorService } from "./blog-mirror.service";
import { BlueskyCrossPostService } from "./bluesky-cross-post.service";
import { ReviewLikesService } from "./review-likes.service";
import { ReviewMediaService } from "./review-media.service";
import { ReviewsController } from "./reviews.controller";
import { ReviewsService } from "./reviews.service";

@Module({
	imports: [PrismaModule, forwardRef(() => AuthModule)],
	controllers: [ReviewsController],
	providers: [
		ReviewsService,
		ReviewMediaService,
		BlogMirrorService,
		BlueskyCrossPostService,
		ReviewLikesService,
	],
	exports: [ReviewsService],
})
export class ReviewsModule {}
