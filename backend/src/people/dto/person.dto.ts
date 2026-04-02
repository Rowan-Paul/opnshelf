import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsNumber, IsOptional, IsString } from "class-validator";

export class PersonFilmographyItemDto {
	@ApiProperty()
	id: number;

	@ApiProperty()
	media_type: "movie" | "tv";

	@ApiProperty()
	title: string;

	@ApiPropertyOptional()
	poster_path?: string;

	@ApiPropertyOptional()
	release_date?: string;

	@ApiPropertyOptional()
	first_air_date?: string;

	@ApiPropertyOptional()
	character?: string;

	@ApiPropertyOptional()
	job?: string;

	@ApiPropertyOptional()
	department?: string;

	@ApiPropertyOptional()
	order?: number;

	@ApiPropertyOptional()
	vote_average?: number;
}

export class TmdbPersonDetailDto {
	@ApiProperty()
	id: number;

	@ApiProperty()
	name: string;

	@ApiPropertyOptional()
	profile_path?: string;

	@ApiPropertyOptional()
	biography?: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsDateString()
	birthday?: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsDateString()
	deathday?: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	place_of_birth?: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	known_for_department?: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsNumber()
	popularity?: number;

	@ApiProperty({ type: [PersonFilmographyItemDto] })
	filmography: PersonFilmographyItemDto[];
}
