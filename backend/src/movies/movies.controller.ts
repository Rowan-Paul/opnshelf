import { Controller, Get, Query, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { MoviesService } from './movies.service';
import { 
  SearchMoviesDto, 
  SearchResultsDto, 
  TrackedMovieDto,
  MovieDto 
} from './dto/movie.dto';

@ApiTags('movies')
@Controller('movies')
export class MoviesController {
  constructor(private readonly moviesService: MoviesService) {}

  @Get('search')
  @ApiOperation({ summary: 'Search movies from TMDB' })
  @ApiQuery({ name: 'query', required: true, description: 'Search term' })
  @ApiResponse({ status: 200, type: SearchResultsDto })
  async searchMovies(@Query() searchDto: SearchMoviesDto) {
    return this.moviesService.searchMovies(searchDto.query);
  }

  @Get('tmdb/:movieId')
  @ApiOperation({ summary: 'Get movie details from TMDB' })
  @ApiResponse({ status: 200 })
  async getMovieDetails(@Param('movieId') movieId: string) {
    return this.moviesService.getMovieDetails(movieId);
  }

  @Get('user/:userDid')
  @ApiOperation({ summary: 'Get tracked movies for a user' })
  @ApiResponse({ status: 200, type: [TrackedMovieDto] })
  async getUserMovies(@Param('userDid') userDid: string) {
    return this.moviesService.getUserMovies(userDid);
  }

  @Get(':movieId')
  @ApiOperation({ summary: 'Get movie from database' })
  @ApiResponse({ status: 200, type: MovieDto })
  async getMovie(@Param('movieId') movieId: string) {
    return this.moviesService.getMovieByTMDBId(movieId);
  }
}