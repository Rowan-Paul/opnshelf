// TODO: Regenerate API client when backend is ready - this is a temporary manual implementation
// Run: pnpm generate:api

import { client } from "./generated/client.gen";
import { type DefaultError, queryOptions } from "@tanstack/react-query";

// Types
export type PersonFilmographyItemDto = {
	id: number;
	media_type: "movie" | "tv";
	title: string;
	poster_path?: string;
	release_date?: string;
	first_air_date?: string;
	character?: string;
	job?: string;
	department?: string;
	order?: number;
	vote_average?: number;
};

export type TmdbPersonDetailDto = {
	id: number;
	name: string;
	profile_path?: string;
	biography?: string;
	birthday?: string;
	deathday?: string;
	place_of_birth?: string;
	known_for_department?: string;
	popularity?: number;
	filmography: PersonFilmographyItemDto[];
};

export type PeopleControllerGetPersonDetailsData = {
	body?: never;
	path: {
		personId: string;
	};
	query?: never;
	url: "/people/tmdb/{personId}";
};

export type PeopleControllerGetPersonDetailsResponse = TmdbPersonDetailDto;

// API Client
export const peopleControllerGetPersonDetails = async (
	options: PeopleControllerGetPersonDetailsData,
): Promise<{ data: PeopleControllerGetPersonDetailsResponse }> => {
	const response = await (options.client ?? client).get<{
		200: PeopleControllerGetPersonDetailsResponse;
	}>({
		url: "/people/tmdb/{personId}",
		...options,
	});

	if (!response.data) {
		throw new Error("Failed to fetch person details");
	}

	return { data: response.data };
};

// Query Key
type QueryKey<T> = [
	T & {
		_id: string;
		tags?: ReadonlyArray<string>;
	},
];

const createQueryKey = <T>(id: string, options?: T): [QueryKey<T>[0]] => {
	const params = { _id: id } as QueryKey<T>[0];
	if (options && "path" in (options as Record<string, unknown>)) {
		(params as Record<string, unknown>).path = (options as Record<string, unknown>).path;
	}
	return [params];
};

export const peopleControllerGetPersonDetailsQueryKey = (
	options: PeopleControllerGetPersonDetailsData,
) => createQueryKey("peopleControllerGetPersonDetails", options);

// React Query Options
export const peopleControllerGetPersonDetailsOptions = (
	options: PeopleControllerGetPersonDetailsData,
) =>
	queryOptions<
		PeopleControllerGetPersonDetailsResponse,
		DefaultError,
		PeopleControllerGetPersonDetailsResponse,
		ReturnType<typeof peopleControllerGetPersonDetailsQueryKey>
	>({
		queryFn: async ({ queryKey }) => {
			const { data } = await peopleControllerGetPersonDetails({
				...options,
				...queryKey[0],
			});
			return data;
		},
		queryKey: peopleControllerGetPersonDetailsQueryKey(options),
	});
