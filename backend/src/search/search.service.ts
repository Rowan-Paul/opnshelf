import { Injectable } from "@nestjs/common";
import { MoviesService } from "../movies/movies.service";
import { ShowsService } from "../shows/shows.service";
import {
	type DiscoverQueryDto,
	type MediaType,
	type UnifiedDiscoverResponseDto,
	type UnifiedSearchResponseDto,
	type UnifiedSearchResultDto,
} from "./dto/search.dto";

interface TMDBSearchItem {
	id: number;
	popularity: number;
	vote_average: number;
	vote_count: number;
	poster_path?: string;
	backdrop_path?: string;
	overview?: string;
	genre_ids?: number[];
	original_language?: string;
	adult?: boolean;
	video?: boolean;
}

interface TMDBSearchMovie extends TMDBSearchItem {
	title: string;
	release_date?: string;
	original_title?: string;
}

interface TMDBSearchShow extends TMDBSearchItem {
	name: string;
	first_air_date?: string;
	original_name?: string;
}

@Injectable()
export class SearchService {
	constructor(
		private moviesService: MoviesService,
		private showsService: ShowsService,
	) {}

	async searchAll(
		query: string,
		page: number = 1,
	): Promise<UnifiedSearchResponseDto> {
		const [movieResults, showResults] = await Promise.all([
			this.moviesService.searchMovies(query, page),
			this.showsService.searchShows(query, page),
		]);

		const unifiedResults = this.mergeResults(
			movieResults.results,
			showResults.results,
		);

		return {
			results: unifiedResults,
			total_results: movieResults.total_results + showResults.total_results,
			page,
		};
	}

	async discoverAll(
		query: DiscoverQueryDto,
	): Promise<UnifiedDiscoverResponseDto> {
		const { sortBy = "popularity.desc", page = 1, year } = query;

		const [movieResults, showResults] = await Promise.all([
			this.moviesService.discoverMovies(sortBy, page, year),
			this.showsService.discoverShows(sortBy, page, year),
		]);

		const unifiedResults = this.mergeResults(
			movieResults.results,
			showResults.results,
		);

		return {
			results: unifiedResults,
			total_results: movieResults.total_results + showResults.total_results,
			page,
		};
	}

	private mergeResults(
		movieResults: TMDBSearchMovie[],
		showResults: TMDBSearchShow[],
	): UnifiedSearchResultDto[] {
		const movieWithType: UnifiedSearchResultDto[] = movieResults.map((m) => ({
			id: m.id,
			media_type: "movie",
			title: m.title,
			poster_path: m.poster_path,
			backdrop_path: m.backdrop_path,
			release_date: m.release_date,
			overview: m.overview,
			popularity: m.popularity,
			vote_average: m.vote_average,
			vote_count: m.vote_count,
			original_language: m.original_language,
			genre_ids: m.genre_ids,
			original_title: m.original_title,
			adult: m.adult,
			video: m.video,
		}));

		const showWithType: UnifiedSearchResultDto[] = showResults.map((s) => ({
			id: s.id,
			media_type: "tv",
			name: s.name,
			poster_path: s.poster_path,
			backdrop_path: s.backdrop_path,
			first_air_date: s.first_air_date,
			overview: s.overview,
			popularity: s.popularity,
			vote_average: s.vote_average,
			vote_count: s.vote_count,
			original_language: s.original_language,
			genre_ids: s.genre_ids,
			original_name: s.original_name,
			adult: s.adult,
			video: s.video,
		}));

		const combined = [...movieWithType, ...showWithType];

		combined.sort((a, b) => {
			if (b.popularity !== a.popularity) {
				return b.popularity - a.popularity;
			}
			return b.vote_count - a.vote_count;
		});

		return combined;
	}
}
