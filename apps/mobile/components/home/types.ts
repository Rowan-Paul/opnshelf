import type { UserDto } from "@opnshelf/api";

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

export type DashboardUser = UserDto;
