import {
	type AddToListDto,
	type CreateListDto,
	listsControllerAddItemToListMutation,
	listsControllerCreateListMutation,
	listsControllerGetListOptions,
	listsControllerGetUserListsOptions,
	listsControllerRemoveItemFromListMutation,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// Get all lists for the current user
export function useUserLists() {
	return useQuery({
		...listsControllerGetUserListsOptions(),
	});
}

// Get a specific list with its items
export function useList(slug: string) {
	return useQuery({
		...listsControllerGetListOptions({
			path: { slug },
		}),
		enabled: !!slug,
	});
}

// Create a new list mutation
export function useCreateList() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (data: CreateListDto) => {
			const mutation = listsControllerCreateListMutation();
			return mutation.mutationFn({ body: data });
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["listsControllerGetUserLists"],
			});
		},
	});
}

// Add item to list mutation
export function useAddItemToList() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			slug,
			data,
		}: {
			slug: string;
			data: AddToListDto;
		}) => {
			const mutation = listsControllerAddItemToListMutation();
			return mutation.mutationFn({
				path: { slug },
				body: data,
			});
		},
		onSuccess: (_, _variables) => {
			queryClient.invalidateQueries({ queryKey: ["listsControllerGetList"] });
			queryClient.invalidateQueries({
				queryKey: ["listsControllerGetUserLists"],
			});
		},
	});
}

// Remove item from list mutation
export function useRemoveItemFromList() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			slug,
			mediaType,
			mediaId,
		}: {
			slug: string;
			mediaType: string;
			mediaId: string;
		}) => {
			const mutation = listsControllerRemoveItemFromListMutation();
			return mutation.mutationFn({
				path: { slug, mediaType, mediaId },
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["listsControllerGetList"] });
			queryClient.invalidateQueries({
				queryKey: ["listsControllerGetUserLists"],
			});
		},
	});
}
