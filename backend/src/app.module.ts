import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AuthModule } from "./auth/auth.module";
import { FeedbackModule } from "./feedback/feedback.module";
import { IngesterModule } from "./ingester/ingester.module";
import { ListsModule } from "./lists/lists.module";
import { MoviesModule } from "./movies/movies.module";
import { NotesModule } from "./notes/notes.module";
import { PeopleModule } from "./people/people.module";
import { RatingsModule } from "./ratings/ratings.module";
import { ReviewsModule } from "./reviews/reviews.module";
import { PrismaModule } from "./prisma/prisma.module";
import { SearchModule } from "./search/search.module";
import { SocialModule } from "./social/social.module";
import { ShelfModule } from "./shelf/shelf.module";
import { ShowsModule } from "./shows/shows.module";
import { UsersModule } from "./users/users.module";

@Module({
	imports: [
		ConfigModule.forRoot({ isGlobal: true }),
		// Global default rate limit: 100 requests / 60s per client IP. This sits
		// alongside the custom AuthGuard and the hand-rolled register/resend
		// limiters as an extra layer. Individual routes may need per-route tuning
		// (override with @Throttle / @SkipThrottle where appropriate).
		ThrottlerModule.forRoot([
			{
				ttl: 60_000,
				limit: 100,
			},
		]),
		PrismaModule,
		MoviesModule,
		AuthModule,
		IngesterModule,
		UsersModule,
		ListsModule,
		NotesModule,
		RatingsModule,
		ReviewsModule,
		ShowsModule,
		ShelfModule,
		SearchModule,
		SocialModule,
		PeopleModule,
		FeedbackModule,
	],
	providers: [
		// ThrottlerGuard as an additional global guard — does not replace the
		// custom AuthGuard, which is applied per-route via @UseGuards.
		{
			provide: APP_GUARD,
			useClass: ThrottlerGuard,
		},
	],
})
export class AppModule {}
