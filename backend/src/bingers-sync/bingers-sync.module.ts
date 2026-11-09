import { forwardRef, Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { IntegrationsModule } from "../integrations/integrations.module";
import { PrismaModule } from "../prisma/prisma.module";
import { BingersSyncClient } from "./bingers-sync.client";
import { BingersSyncController } from "./bingers-sync.controller";
import { BingersSyncService } from "./bingers-sync.service";

@Module({
	imports: [PrismaModule, IntegrationsModule, forwardRef(() => AuthModule)],
	controllers: [BingersSyncController],
	providers: [BingersSyncClient, BingersSyncService],
	exports: [BingersSyncService],
})
export class BingersSyncModule {}
