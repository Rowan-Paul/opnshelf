import { forwardRef, Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { LibraryModule } from "../library/library.module";
import { ListsModule } from "../lists/lists.module";
import { MoviesModule } from "../movies/movies.module";
import { NotesModule } from "../notes/notes.module";
import { PrismaModule } from "../prisma/prisma.module";
import { RatingsModule } from "../ratings/ratings.module";
import { ShowsModule } from "../shows/shows.module";
import { LocalSyncContent } from "./local-content.service";
import { LocalSyncLists } from "./local-lists.service";
import { LocalSyncRecords } from "./local-records.service";

/** Opnshelf-side record access shared by every Integration provider (ADR 0051). */
@Module({
	imports: [
		PrismaModule,
		ListsModule,
		NotesModule,
		LibraryModule,
		MoviesModule,
		ShowsModule,
		RatingsModule,
		forwardRef(() => AuthModule),
	],
	providers: [LocalSyncLists, LocalSyncContent, LocalSyncRecords],
	exports: [LocalSyncRecords],
})
export class IntegrationsModule {}
