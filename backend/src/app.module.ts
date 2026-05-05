import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "./auth/auth.module";
import { IngesterModule } from "./ingester/ingester.module";
import { ListsModule } from "./lists/lists.module";
import { MoviesModule } from "./movies/movies.module";
import { NotesModule } from "./notes/notes.module";
import { PeopleModule } from "./people/people.module";
import { PrismaModule } from "./prisma/prisma.module";
import { SearchModule } from "./search/search.module";
import { SocialModule } from "./social/social.module";
import { ShelfModule } from "./shelf/shelf.module";
import { ShowsModule } from "./shows/shows.module";
import { UsersModule } from "./users/users.module";

@Module({
	imports: [
		ConfigModule.forRoot({ isGlobal: true }),
		PrismaModule,
		MoviesModule,
		AuthModule,
		IngesterModule,
		UsersModule,
		ListsModule,
		NotesModule,
		ShowsModule,
		ShelfModule,
		SearchModule,
		SocialModule,
		PeopleModule,
	],
})
export class AppModule {}
