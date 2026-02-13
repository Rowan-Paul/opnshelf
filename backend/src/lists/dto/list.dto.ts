import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CreateListDto {
	@ApiProperty({
		description: "Name of the list",
		minLength: 1,
		maxLength: 100,
	})
	@IsString()
	@MinLength(1)
	@MaxLength(100)
	name: string;

	@ApiPropertyOptional({
		description: "Description of the list",
		maxLength: 500,
	})
	@IsOptional()
	@IsString()
	@MaxLength(500)
	description?: string;
}

export class UpdateListDto {
	@ApiPropertyOptional({
		description: "Name of the list",
		minLength: 1,
		maxLength: 100,
	})
	@IsOptional()
	@IsString()
	@MinLength(1)
	@MaxLength(100)
	name?: string;

	@ApiPropertyOptional({
		description: "Description of the list",
		maxLength: 500,
	})
	@IsOptional()
	@IsString()
	@MaxLength(500)
	description?: string;
}

export class AddToListDto {
	@ApiProperty({ description: "TMDB movie ID" })
	@IsString()
	movieId: string;

	@ApiPropertyOptional({ description: "Optional notes about the movie" })
	@IsOptional()
	@IsString()
	@MaxLength(1000)
	notes?: string;
}

export class RemoveFromListDto {
	@ApiProperty({ description: "TMDB movie ID" })
	@IsString()
	movieId: string;
}

export class MovieInListDto {
	@ApiProperty()
	id: string;

	@ApiProperty()
	rkey: string;

	@ApiProperty()
	movieId: string;

	@ApiPropertyOptional()
	notes?: string;

	@ApiProperty()
	position: number;

	@ApiProperty()
	createdAt: string;

	@ApiProperty()
	movie: {
		movieId: string;
		title: string;
		posterPath?: string;
		backdropPath?: string;
		releaseYear?: number;
		releaseDate?: string;
		overview?: string;
		colors?: {
			primary?: string;
			secondary?: string;
			accent?: string;
			muted?: string;
		};
	};
}

export class MovieListDto {
	@ApiProperty()
	id: string;

	@ApiProperty()
	rkey: string;

	@ApiProperty()
	uri: string;

	@ApiProperty()
	userDid: string;

	@ApiProperty()
	name: string;

	@ApiPropertyOptional()
	description?: string;

	@ApiProperty()
	slug: string;

	@ApiProperty()
	isDefault: boolean;

	@ApiProperty()
	createdAt: string;

	@ApiProperty()
	updatedAt: string;

	@ApiPropertyOptional({ type: MovieInListDto, isArray: true })
	items?: MovieInListDto[];
}

export class MovieListSummaryDto {
	@ApiProperty()
	id: string;

	@ApiProperty()
	rkey: string;

	@ApiProperty()
	name: string;

	@ApiPropertyOptional()
	description?: string;

	@ApiProperty()
	slug: string;

	@ApiProperty()
	isDefault: boolean;

	@ApiProperty()
	movieCount: number;

	@ApiProperty()
	createdAt: string;

	@ApiProperty()
	updatedAt: string;
}

export class MovieListWithMoviesDto {
	@ApiProperty()
	id: string;

	@ApiProperty()
	rkey: string;

	@ApiProperty()
	uri: string;

	@ApiProperty()
	userDid: string;

	@ApiProperty()
	name: string;

	@ApiPropertyOptional()
	description?: string;

	@ApiProperty()
	slug: string;

	@ApiProperty()
	isDefault: boolean;

	@ApiProperty()
	createdAt: string;

	@ApiProperty()
	updatedAt: string;

	@ApiProperty({ type: [MovieInListDto] })
	items: MovieInListDto[];
}

export class MovieListsForMovieDto {
	@ApiProperty()
	listId: string;

	@ApiProperty()
	listName: string;

	@ApiProperty()
	listSlug: string;

	@ApiProperty()
	isDefault: boolean;

	@ApiProperty()
	isInList: boolean;
}
