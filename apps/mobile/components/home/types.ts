import type {
	ShelfActivityBucketDto,
	ShelfActivitySummaryDto,
	UserDto,
} from "@opnshelf/api";

export type DashboardRange = "week" | "month";

export type DashboardShelfItem = {
	id: string;
	type: "movie" | "episode";
	movieId?: string;
	showId?: string;
	title?: string;
	showTitle?: string;
	seasonNumber?: number;
	episodeNumber?: number;
	posterPath?: string | null;
	createdAt: string;
	watchedDate?: string | null;
};

export type DashboardListItem = {
	id: string;
	name: string;
	slug: string;
	movieCount: number;
	updatedAt: string;
};

export type DashboardActivitySummary = ShelfActivitySummaryDto;
export type DashboardActivityBucket = ShelfActivityBucketDto;
export type DashboardActivityBar = {
	key: string;
	value: number;
	label: string;
	showLabel: boolean;
};

export type DashboardUser = UserDto;
