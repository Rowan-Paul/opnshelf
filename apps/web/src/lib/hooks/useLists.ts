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
			if (!mutation.mutationFn) {
				throw new Error("Mutation function not available");
			}
			return mutation.mutationFn({ body: data });
		},
		mutationKey: ["lists", "create"],
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
			if (!mutation.mutationFn) {
				throw new Error("Mutation function not available");
			}
			const result = await mutation.mutationFn({
				path: { slug },
				body: data,
			});
			return result.data;
		},
		mutationKey: ["lists", "addItem"],
		onSuccess: () => {
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
			if (!mutation.mutationFn) {
				throw new Error("Mutation function not available");
			}
			const result = await mutation.mutationFn({
				path: { slug, mediaType, mediaId },
			});
			return result.data;
		},
		mutationKey: ["lists", "removeItem"],
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["listsControllerGetList"] });
			queryClient.invalidateQueries({
				queryKey: ["listsControllerGetUserLists"],
			});
		},
	});
}
