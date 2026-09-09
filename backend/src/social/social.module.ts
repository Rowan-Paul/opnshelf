import { forwardRef, Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { ActivityFeedService } from "./activity-feed.service";
import { CirclesService } from "./circles.service";
import { FollowsService } from "./follows.service";
import { SocialController } from "./social.controller";
import { SocialService } from "./social.service";
import { SocialUsersService } from "./social-users.service";

@Module({
	imports: [PrismaModule, forwardRef(() => AuthModule)],
	controllers: [SocialController],
	providers: [
		SocialUsersService,
		FollowsService,
		CirclesService,
		ActivityFeedService,
		SocialService,
	],
	exports: [SocialService],
})
export class SocialModule {}
