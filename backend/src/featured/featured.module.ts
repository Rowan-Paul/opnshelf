import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { FeaturedAdminGuard } from "./featured-admin.guard";
import { FeaturedCatalogueService } from "./featured-catalogue.service";
import { FeaturedController } from "./featured.controller";
import { FeaturedService } from "./featured.service";

@Module({
	imports: [AuthModule, PrismaModule],
	controllers: [FeaturedController],
	providers: [FeaturedService, FeaturedCatalogueService, FeaturedAdminGuard],
})
export class FeaturedModule {}
