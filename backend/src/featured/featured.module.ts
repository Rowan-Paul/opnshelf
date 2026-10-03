import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { FeaturedAdminGuard } from "./featured-admin.guard";
import { FeaturedCatalogService } from "./featured-catalog.service";
import { FeaturedController } from "./featured.controller";
import { FeaturedService } from "./featured.service";

@Module({
	imports: [AuthModule, PrismaModule],
	controllers: [FeaturedController],
	providers: [FeaturedService, FeaturedCatalogService, FeaturedAdminGuard],
})
export class FeaturedModule {}
