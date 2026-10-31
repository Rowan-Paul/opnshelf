import { forwardRef, Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { IntegrationsModule } from "../integrations/integrations.module";
import { PrismaModule } from "../prisma/prisma.module";
import { TraktSyncClient } from "./trakt-sync.client";
import { TraktSyncController } from "./trakt-sync.controller";
import { TraktSyncService } from "./trakt-sync.service";

@Module({
	imports: [PrismaModule, IntegrationsModule, forwardRef(() => AuthModule)],
	controllers: [TraktSyncController],
	providers: [TraktSyncClient, TraktSyncService],
	exports: [TraktSyncService],
})
export class TraktSyncModule {}
