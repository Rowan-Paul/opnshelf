import { forwardRef, Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { IntegrationsModule } from "../integrations/integrations.module";
import { PrismaModule } from "../prisma/prisma.module";
import { PopfeedSyncClient } from "./popfeed-sync.client";
import { PopfeedSyncController } from "./popfeed-sync.controller";
import { PopfeedSyncService } from "./popfeed-sync.service";

@Module({
	imports: [PrismaModule, IntegrationsModule, forwardRef(() => AuthModule)],
	controllers: [PopfeedSyncController],
	providers: [PopfeedSyncClient, PopfeedSyncService],
	exports: [PopfeedSyncService],
})
export class PopfeedSyncModule {}
