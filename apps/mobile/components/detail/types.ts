import type { ReactNode } from "react";

export type EpisodeReference = {
	seasonNumber: number;
	episodeNumber: number;
};

export type EpisodeContext = {
	previous: EpisodeReference | null;
	next: EpisodeReference | null;
};

export type ColorTheme = {
	primary?: string;
	secondary?: string;
	accent?: string;
	muted?: string;
};

export type EpisodeSummary = {
	episode_number: number;
	name: string;
	air_date?: string;
	overview?: string;
	still_path?: string;
	vote_average?: number;
	_context?: EpisodeContext;
};

export type SeasonSummary = {
	season_number: number;
	name: string;
	air_date?: string;
	overview?: string;
	poster_path?: string;
	episode_count: number;
};

export type MetadataPill = {
	icon?: ReactNode;
	label: string;
	onPress?: () => void;
};

export type BreadcrumbItem = {
	label: string;
	onPress?: () => void;
};
