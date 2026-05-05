import { forwardRef, Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { NotesController } from "./notes.controller";
import { NotesService } from "./notes.service";

@Module({
	imports: [PrismaModule, forwardRef(() => AuthModule)],
	controllers: [NotesController],
	providers: [NotesService],
	exports: [NotesService],
})
export class NotesModule {}
