import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, IsDateString } from 'class-validator';

export class MovieColorsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  primary?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  secondary?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  accent?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  muted?: string;
}

export class MovieDto {
  @ApiProperty()
  @IsString()
  movieId: string;

  @ApiProperty()
  @IsString()
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  posterPath?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  backdropPath?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  releaseYear?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  releaseDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  overview?: string;

  @ApiPropertyOptional({ type: MovieColorsDto })
  @IsOptional()
  colors?: MovieColorsDto;
}

export class TrackedMovieDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  rkey: string;

  @ApiProperty()
  uri: string;

  @ApiProperty()
  cid: string;

  @ApiProperty()
  userDid: string;

  @ApiProperty()
  movieId: string;

  @ApiProperty()
  status: string;

  @ApiPropertyOptional()
  watchedDate?: string;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;

  @ApiProperty({ type: MovieDto })
  movie: MovieDto;
}

export class SearchMoviesDto {
  @ApiProperty()
  @IsString()
  query: string;
}

export class TMDBMovieResultDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  title: string;

  @ApiPropertyOptional()
  poster_path?: string;

  @ApiPropertyOptional()
  backdrop_path?: string;

  @ApiPropertyOptional()
  release_date?: string;

  @ApiPropertyOptional()
  overview?: string;
}

export class TMDBGenreDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;
}

export class TMDBMovieDetailDto extends TMDBMovieResultDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  runtime?: number;

  @ApiPropertyOptional()
  vote_average?: number;

  @ApiPropertyOptional()
  vote_count?: number;

  @ApiPropertyOptional({ type: [TMDBGenreDto] })
  genres?: TMDBGenreDto[];

  @ApiPropertyOptional({ type: MovieColorsDto })
  @IsOptional()
  colors?: MovieColorsDto;
}

export class SearchResultsDto {
  @ApiProperty({ type: [TMDBMovieResultDto] })
  results: TMDBMovieResultDto[];

  @ApiProperty()
  total_results: number;

  @ApiProperty()
  page: number;
}

export class MarkWatchedDto {
  @ApiProperty({ description: 'TMDB movie ID' })
  @IsString()
  movieId: string;

  @ApiPropertyOptional({
    description:
      'Custom watch datetime (ISO 8601). If not provided, current time is used.',
  })
  @IsOptional()
  @IsDateString()
  watchedAt?: string;
}

export class UnmarkWatchedDto {
  @ApiProperty({ description: 'Movie ID to unmark' })
  @IsString()
  movieId: string;

  @ApiPropertyOptional({
    description:
      'Mode: "latest" removes most recent watch, "all" removes all watches',
    enum: ['latest', 'all'],
    default: 'latest',
  })
  @IsOptional()
  @IsString()
  mode?: 'latest' | 'all';
}

export class WatchHistoryItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  watchedDate: string;
}
