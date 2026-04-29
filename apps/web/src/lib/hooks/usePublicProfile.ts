import type { PaginatedSocialUsersDto } from "@opnshelf/api";
import { client } from "@opnshelf/api";
import { useQuery } from "@tanstack/react-query";

// Custom API functions for public profile endpoints not yet in the generated SDK

export async function getPublicFollowers(
	handle: string,
	page = 1,
	pageSize = 20,
): Promise<PaginatedSocialUsersDto> {
	const { data } = await client.get({
		url: `/users/${handle}/followers`,
		query: { page, pageSize },
	});
	return data as PaginatedSocialUsersDto;
}

export async function getPublicFollowing(
	handle: string,
	page = 1,
	pageSize = 20,
): Promise<PaginatedSocialUsersDto> {
	const { data } = await client.get({
		url: `/users/${handle}/following`,
		query: { page, pageSize },
	});
	return data as PaginatedSocialUsersDto;
}

// TanStack Query hooks

export function usePublicFollowers(handle: string, page = 1, pageSize = 20) {
	return useQuery({
		queryKey: ["public-profile", "followers", handle, page, pageSize],
		queryFn: () => getPublicFollowers(handle, page, pageSize),
		enabled: !!handle,
	});
}

export function usePublicFollowing(handle: string, page = 1, pageSize = 20) {
	return useQuery({
		queryKey: ["public-profile", "following", handle, page, pageSize],
		queryFn: () => getPublicFollowing(handle, page, pageSize),
		enabled: !!handle,
	});
}
