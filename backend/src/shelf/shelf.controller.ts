import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { ShelfQueryDto, ShelfResponseDto } from "./shelf.dto";
import { ShelfService } from "./shelf.service";

@ApiTags("shelf")
@Controller("shelf")
export class ShelfController {
	constructor(private readonly shelfService: ShelfService) {}

	@Get("user/:userDid")
	@ApiOperation({
		summary: "Get paginated shelf items for a user (movies and episodes)",
	})
	@ApiResponse({ status: 200, type: ShelfResponseDto })
	async getUserShelf(
		@Param("userDid") userDid: string,
		@Query() query: ShelfQueryDto,
	): Promise<ShelfResponseDto> {
		const limit = query.limit ?? 20;
		const result = await this.shelfService.getUserShelf(
			userDid,
			limit,
			query.cursor,
		);

		// Transform items to DTO format
		const items = result.items.map((item) => {
			if (item.type === "movie") {
				const movieData = item.data as {
					id: string;
					movieId: string;
					title: string;
					posterPath?: string;
					backdropPath?: string;
					releaseYear?: number;
					overview?: string;
					colors?: unknown;
					watchedDate: Date | null;
					createdAt: Date;
				};
				return {
					id: movieData.id,
					type: "movie" as const,
					movieId: movieData.movieId,
					title: movieData.title,
					posterPath: movieData.posterPath,
					backdropPath: movieData.backdropPath,
					releaseYear: movieData.releaseYear,
					overview: movieData.overview,
					colors: movieData.colors as
						| {
								primary?: string;
								secondary?: string;
								accent?: string;
								muted?: string;
						  }
						| undefined,
					watchedDate: movieData.watchedDate?.toISOString(),
					createdAt: movieData.createdAt.toISOString(),
				};
			}
			const episodeData = item.data as {
				id: string;
				showId: string;
				showTitle: string;
				seasonNumber: number;
				episodeNumber: number;
				posterPath?: string;
				backdropPath?: string;
				firstAirYear?: number;
				overview?: string;
				colors?: unknown;
				watchedDate: Date | null;
				createdAt: Date;
			};
			return {
				id: episodeData.id,
				type: "episode" as const,
				showId: episodeData.showId,
				showTitle: episodeData.showTitle,
				seasonNumber: episodeData.seasonNumber,
				episodeNumber: episodeData.episodeNumber,
				posterPath: episodeData.posterPath,
				backdropPath: episodeData.backdropPath,
				firstAirYear: episodeData.firstAirYear,
				overview: episodeData.overview,
				colors: episodeData.colors as
					| {
							primary?: string;
							secondary?: string;
							accent?: string;
							muted?: string;
					  }
					| undefined,
				watchedDate: episodeData.watchedDate?.toISOString(),
				createdAt: episodeData.createdAt.toISOString(),
			};
		});

		return {
			items,
			nextCursor: result.nextCursor,
			total: result.total,
		};
	}
}
