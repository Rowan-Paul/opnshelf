import { forwardRef, Module } from "@nestjs/common";
import { LibraryModule } from "../library/library.module";
import { ListsModule } from "../lists/lists.module";
import { MoviesModule } from "../movies/movies.module";
import { NotesModule } from "../notes/notes.module";
import { PrismaModule } from "../prisma/prisma.module";
import { RatingsModule } from "../ratings/ratings.module";
import { ReviewsModule } from "../reviews/reviews.module";
import { SocialModule } from "../social/social.module";
import { ShowsModule } from "../shows/shows.module";
import { UsersModule } from "../users/users.module";
import { IngesterService } from "./ingester.service";

@Module({
	imports: [
		PrismaModule,
		forwardRef(() => MoviesModule),
		forwardRef(() => ShowsModule),
		forwardRef(() => ListsModule),
		forwardRef(() => LibraryModule),
		forwardRef(() => NotesModule),
		forwardRef(() => RatingsModule),
		forwardRef(() => ReviewsModule),
		forwardRef(() => SocialModule),
		forwardRef(() => UsersModule),
	],
	providers: [IngesterService],
	exports: [IngesterService],
})
export class IngesterModule {}
