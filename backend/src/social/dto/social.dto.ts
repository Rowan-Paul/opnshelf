import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
	IsIn,
	IsInt,
	IsOptional,
	IsString,
	Max,
	MaxLength,
	Min,
	MinLength,
} from "class-validator";
import { MovieColorsDto } from "../../movies/dto/movie.dto";

export class SocialUserCardDto {
	@ApiProperty()
	did: string;

	@ApiProperty()
	handle: string;

	@ApiPropertyOptional({ nullable: true })
	displayName: string | null;

	@ApiPropertyOptional({ nullable: true })
	avatar: string | null;

	@ApiProperty()
	followersCount: number;

	@ApiProperty()
	followingCount: number;

	@ApiProperty()
	isFollowing: boolean;

	@ApiProperty()
	isFollowedBy: boolean;

	@ApiPropertyOptional({
		type: [String],
		description:
			"Ids of the viewer's circles this user belongs to. Only populated when the viewer requests their own following list.",
	})
	circleIds?: string[];
}

export class SocialActorDto {
	@ApiProperty()
	did: string;

	@ApiProperty()
	handle: string;

	@ApiPropertyOptional({ nullable: true })
	displayName: string | null;

	@ApiPropertyOptional({ nullable: true })
	avatar: string | null;

	@ApiProperty()
	followersCount: number;

	@ApiProperty()
	followingCount: number;
}

export class UserRelationshipDto {
	@ApiProperty()
	targetDid: string;

	@ApiProperty()
	isFollowing: boolean;

	@ApiProperty()
	isFollowedBy: boolean;

	@ApiProperty()
	canFollow: boolean;
}

export class SocialPaginationQueryDto {
	@ApiPropertyOptional({
		description: "Page number to return",
		default: 1,
	})
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	page?: number;

	@ApiPropertyOptional({
		description: "Number of items to return per page",
		default: 20,
	})
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(50)
	pageSize?: number;
}

export class SocialFeedPaginationQueryDto {
	@ApiPropertyOptional({
		description: "Page number to return",
		default: 1,
	})
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	page?: number;

	@ApiPropertyOptional({
		description: "Number of items to return per page",
		default: 10,
	})
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(25)
	pageSize?: number;
}

export class SocialWatchersQueryDto {
	@ApiProperty({ enum: ["movie", "show"] })
	@IsString()
	@IsIn(["movie", "show"])
	mediaType: "movie" | "show";

	@ApiProperty({
		description:
			'Movie TMDB id or scoped show media id such as "showId", "showId:season:1", or "showId:season:1:episode:2"',
	})
	@IsString()
	mediaId: string;

	@ApiPropertyOptional({
		description: "Maximum number of watcher avatars to return",
		default: 3,
	})
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(10)
	pageSize?: number;
}

export class SocialSearchQueryDto extends SocialPaginationQueryDto {
	@ApiProperty({
		description: "Search term for handle or display name",
	})
	@IsString()
	q: string;
}

export class PaginatedSocialUsersDto {
	@ApiProperty({ type: [SocialUserCardDto] })
	items: SocialUserCardDto[];

	@ApiProperty()
	page: number;

	@ApiProperty()
	pageSize: number;

	@ApiProperty()
	total: number;

	@ApiProperty()
	totalPages: number;

	@ApiProperty()
	hasNextPage: boolean;

	@ApiProperty()
	hasPreviousPage: boolean;
}

export class CircleDto {
	@ApiProperty()
	id: string;

	@ApiProperty()
	name: string;

	@ApiProperty({ description: "Number of followed users in this circle" })
	memberCount: number;

	@ApiProperty()
	createdAt: string;
}

export class UpsertCircleDto {
	@ApiProperty({ description: "Circle name", maxLength: 50 })
	@IsString()
	@MaxLength(50)
	@MinLength(1)
	name: string;
}

export class CircleFeedPaginationQueryDto extends SocialFeedPaginationQueryDto {
	@ApiPropertyOptional({
		description: "Restrict the feed to a single circle of followed users",
	})
	@IsOptional()
	@IsString()
	circleId?: string;
}

export class FollowedActivityItemDto {
	@ApiProperty({ type: SocialActorDto })
	actor: SocialActorDto;

	@ApiProperty()
	id: string;

	@ApiProperty({ enum: ["movie", "episode", "review"] })
	type: "movie" | "episode" | "review";

	@ApiProperty()
	activityAt: string;

	@ApiPropertyOptional()
	movieId?: string;

	@ApiPropertyOptional()
	title?: string;

	@ApiPropertyOptional()
	showId?: string;

	@ApiPropertyOptional()
	showTitle?: string;

	@ApiPropertyOptional()
	seasonNumber?: number;

	@ApiPropertyOptional()
	episodeNumber?: number;

	@ApiPropertyOptional()
	episodeName?: string;

	@ApiPropertyOptional()
	episodeOverview?: string;

	@ApiPropertyOptional()
	stillPath?: string;

	@ApiPropertyOptional()
	posterPath?: string;

	@ApiPropertyOptional()
	backdropPath?: string;

	@ApiPropertyOptional()
	releaseYear?: number;

	@ApiPropertyOptional()
	firstAirYear?: number;

	@ApiPropertyOptional()
	overview?: string;

	@ApiPropertyOptional({ type: MovieColorsDto })
	colors?: MovieColorsDto;

	@ApiPropertyOptional()
	watchedDate?: string;

	@ApiPropertyOptional({
		description: "Rating for review activities (1-10 scale)",
	})
	rating?: number;

	@ApiPropertyOptional({
		description: "Review text content for review activities",
	})
	reviewContent?: string;

	@ApiProperty()
	createdAt: string;
}

export class FollowedActivityFeedDto {
	@ApiProperty({ type: [FollowedActivityItemDto] })
	items: FollowedActivityItemDto[];

	@ApiProperty()
	page: number;

	@ApiProperty()
	pageSize: number;

	@ApiProperty()
	total: number;

	@ApiProperty()
	totalPages: number;

	@ApiProperty()
	hasNextPage: boolean;

	@ApiProperty()
	hasPreviousPage: boolean;
}

export class FollowedWatcherActorDto {
	@ApiProperty()
	did: string;

	@ApiProperty()
	handle: string;

	@ApiPropertyOptional({ type: String, nullable: true })
	displayName: string | null;

	@ApiPropertyOptional({ type: String, nullable: true })
	avatar: string | null;
}

export class FollowedWatcherDto {
	@ApiProperty({ type: FollowedWatcherActorDto })
	actor: FollowedWatcherActorDto;

	@ApiProperty()
	activityAt: string;
}

export class FollowedWatchersDto {
	@ApiProperty({ type: [FollowedWatcherDto] })
	items: FollowedWatcherDto[];

	@ApiProperty()
	pageSize: number;

	@ApiProperty()
	total: number;
}
