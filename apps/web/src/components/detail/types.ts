import type { ReactNode } from "react";

export type ColorTheme = {
	primary: string;
	secondary: string;
	accent: string;
	muted: string;
};

export type BreadcrumbItem = {
	label: string;
	linkTo?: {
		to: string;
		params: Record<string, string>;
	};
};

export type MetadataPill = {
	icon?: ReactNode;
	label: string;
	linkTo?: {
		to: string;
		params: Record<string, string>;
	};
};

export type EpisodeSummary = {
	episode_number: number;
	name: string;
	air_date?: string;
	overview?: string;
	still_path?: string;
	vote_average?: number;
};

export type SeasonSummary = {
	season_number: number;
	name: string;
	air_date?: string;
	overview?: string;
	poster_path?: string;
	episode_count: number;
};
