import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, IsDateString } from 'class-validator';

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

export class SearchResultsDto {
  @ApiProperty({ type: [TMDBMovieResultDto] })
  results: TMDBMovieResultDto[];

  @ApiProperty()
  total_results: number;

  @ApiProperty()
  page: number;
}