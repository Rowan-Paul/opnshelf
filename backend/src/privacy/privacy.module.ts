import { RetiredSettingsCleanup } from "./retired-settings-cleanup";
import { PdsModule } from "../pds/pds.module";
import { forwardRef, Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { LibraryModule } from "../library/library.module";
import { ListsModule } from "../lists/lists.module";
import { NotesModule } from "../notes/notes.module";
import { MoviesModule } from "../movies/movies.module";
import { ShowsModule } from "../shows/shows.module";
import { PrivacyController } from "./privacy.controller";
import { ContentPrivacyService } from "./content-privacy.service";
import { ContentPrivacyProjection } from "./content-privacy-projection";
import { WatchPrivacyService } from "./watch-privacy.service";
import { WatchPrivacyController } from "./watch-privacy.controller";

@Module({
	imports: [
		PdsModule,
		PrismaModule,
		forwardRef(() => AuthModule),
		forwardRef(() => LibraryModule),
		forwardRef(() => ListsModule),
		forwardRef(() => NotesModule),
		forwardRef(() => MoviesModule),
		forwardRef(() => ShowsModule),
	],
	controllers: [PrivacyController, WatchPrivacyController],
	providers: [
		RetiredSettingsCleanup,
		ContentPrivacyService,
		ContentPrivacyProjection,
		WatchPrivacyService,
	],
	exports: [RetiredSettingsCleanup, ContentPrivacyService, WatchPrivacyService],
})
export class PrivacyModule {}
