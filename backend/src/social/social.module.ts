import { forwardRef, Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { SocialController } from "./social.controller";
import { SocialService } from "./social.service";

@Module({
	imports: [PrismaModule, forwardRef(() => AuthModule)],
	controllers: [SocialController],
	providers: [SocialService],
	exports: [SocialService],
})
export class SocialModule {}
