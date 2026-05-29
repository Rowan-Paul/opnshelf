import { forwardRef, Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { RatingsController } from "./ratings.controller";
import { RatingsService } from "./ratings.service";

@Module({
	imports: [PrismaModule, forwardRef(() => AuthModule)],
	controllers: [RatingsController],
	providers: [RatingsService],
	exports: [RatingsService],
})
export class RatingsModule {}
