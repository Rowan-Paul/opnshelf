import { Module } from "@nestjs/common";
import { MoviesModule } from "../movies/movies.module";
import { ShowsModule } from "../shows/shows.module";
import { SearchController } from "./search.controller";
import { SearchService } from "./search.service";

@Module({
	imports: [MoviesModule, ShowsModule],
	controllers: [SearchController],
	providers: [SearchService],
	exports: [SearchService],
})
export class SearchModule {}
