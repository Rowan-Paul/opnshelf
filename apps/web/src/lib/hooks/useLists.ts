import {
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
		...listsControllerCreateListMutation(),
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
		...listsControllerAddItemToListMutation(),
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
		...listsControllerRemoveItemFromListMutation(),
		mutationKey: ["lists", "removeItem"],
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["listsControllerGetList"] });
			queryClient.invalidateQueries({
				queryKey: ["listsControllerGetUserLists"],
			});
		},
	});
}
