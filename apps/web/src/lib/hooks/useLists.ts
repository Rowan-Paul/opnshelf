import {
	type ListSummaryDto,
	type ListsControllerGetUserListsResponse,
	listsControllerCreateListMutation,
	listsControllerGetListOptions,
	listsControllerGetListQueryKey,
	listsControllerGetUserListsOptions,
	listsControllerGetUserListsQueryKey,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

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
	const userListsKey = listsControllerGetUserListsQueryKey();

	return useMutation({
		mutationKey: ["lists", "create"],
		...listsControllerCreateListMutation(),
		onSuccess: async (newList) => {
			toast.success("List created");
			queryClient.setQueryData(
				userListsKey,
				(currentLists: ListsControllerGetUserListsResponse | undefined) => {
					if (!currentLists) return currentLists;
					if (currentLists.some((list) => list.slug === newList.slug)) {
						return currentLists;
					}

					const newListSummary: ListSummaryDto = {
						id: newList.id,
						rkey: newList.rkey,
						name: newList.name,
						description: newList.description,
						slug: newList.slug,
						isDefault: newList.isDefault,
						itemCount: 0,
						createdAt: newList.createdAt,
						updatedAt: newList.updatedAt,
					};

					return [newListSummary, ...currentLists];
				},
			);

			await queryClient.refetchQueries({
				queryKey: userListsKey,
				type: "all",
			});
		},
		onError: (error) => {
			toast.error(
				error instanceof Error ? error.message : "Failed to create list",
			);
		},
	});
}

// Invalidate both the user's list of lists and a specific list's contents
export function invalidateListQueries(
	queryClient: ReturnType<typeof useQueryClient>,
	slug?: string,
) {
	queryClient.invalidateQueries({
		queryKey: listsControllerGetUserListsQueryKey(),
	});
	if (slug) {
		queryClient.invalidateQueries({
			queryKey: listsControllerGetListQueryKey({ path: { slug } }),
		});
	}
}
