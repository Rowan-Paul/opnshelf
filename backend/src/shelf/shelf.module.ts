import { Module } from "@nestjs/common";
import { ColorExtractionService } from "../movies/color-extraction.service";
import { PrismaModule } from "../prisma/prisma.module";
import { ShelfController } from "./shelf.controller";
import { ShelfService } from "./shelf.service";

@Module({
	imports: [PrismaModule],
	controllers: [ShelfController],
	providers: [ShelfService, ColorExtractionService],
	exports: [ShelfService],
})
export class ShelfModule {}
