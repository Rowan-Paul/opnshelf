import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsNumber, IsOptional, IsString } from "class-validator";

export class PersonFilmographyRoleDto {
	@ApiProperty({ description: "Type of role (cast or crew)" })
	type: "cast" | "crew";

	@ApiPropertyOptional({ description: "Character name for cast roles" })
	character?: string;

	@ApiPropertyOptional({ description: "Job title for crew roles" })
	job?: string;

	@ApiPropertyOptional({ description: "Department for crew roles" })
	department?: string;

	@ApiPropertyOptional({
		description: "Billing order for cast roles (lower is higher billing)",
	})
	order?: number;
}

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
	backdrop_path?: string;

	@ApiPropertyOptional()
	release_date?: string;

	@ApiPropertyOptional()
	first_air_date?: string;

	@ApiPropertyOptional({
		description:
			"Legacy field: character name (use roles array for merged items)",
		deprecated: true,
	})
	character?: string;

	@ApiPropertyOptional({
		description: "Legacy field: job title (use roles array for merged items)",
		deprecated: true,
	})
	job?: string;

	@ApiPropertyOptional({
		description: "Legacy field: department (use roles array for merged items)",
		deprecated: true,
	})
	department?: string;

	@ApiPropertyOptional({
		description:
			"Legacy field: billing order (use roles array for merged items)",
		deprecated: true,
	})
	order?: number;

	@ApiPropertyOptional()
	vote_average?: number;

	@ApiPropertyOptional({
		type: [PersonFilmographyRoleDto],
		description:
			"Array of roles when person has multiple credits for the same title (e.g., actor + director)",
	})
	roles?: PersonFilmographyRoleDto[];
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

export class PersonFilmographyResponseDto {
	@ApiProperty({ type: [PersonFilmographyItemDto] })
	items: PersonFilmographyItemDto[];

	@ApiProperty()
	total: number;

	@ApiProperty()
	page: number;

	@ApiProperty()
	pageSize: number;

	@ApiProperty()
	totalPages: number;
}

export class PersonSearchResultDto {
	@ApiProperty()
	id: number;

	@ApiProperty()
	name: string;

	@ApiPropertyOptional()
	profile_path?: string;

	@ApiPropertyOptional({
		description: "Primary department, e.g. Acting, Directing",
	})
	known_for_department?: string;

	@ApiPropertyOptional()
	popularity?: number;
}

export class PersonSearchResponseDto {
	@ApiProperty({ type: [PersonSearchResultDto] })
	results: PersonSearchResultDto[];

	@ApiProperty()
	page: number;

	@ApiProperty()
	total_results: number;

	@ApiProperty()
	total_pages: number;
}

export class PersonFilmographyQueryDto {
	@ApiPropertyOptional({ description: "Page number (1-based)", default: 1 })
	@IsOptional()
	@IsNumber()
	page?: number = 1;

	@ApiPropertyOptional({ description: "Items per page", default: 20 })
	@IsOptional()
	@IsNumber()
	pageSize?: number = 20;
}
