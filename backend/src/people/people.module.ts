import { Module } from "@nestjs/common";
import { PeopleController } from "./people.controller";
import { PeopleService } from "./people.service";
import { PeopleTmdbService } from "./people-tmdb.service";

@Module({
	controllers: [PeopleController],
	providers: [PeopleService, PeopleTmdbService],
})
export class PeopleModule {}
