import {
	socialControllerAddCircleMemberMutation,
	socialControllerCreateCircleMutation,
	socialControllerDeleteCircleMutation,
	socialControllerGetCircleMembersOptions,
	socialControllerListCirclesOptions,
	socialControllerListCirclesQueryKey,
	socialControllerRemoveCircleMemberMutation,
	socialControllerRenameCircleMutation,
} from "@opnshelf/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// The viewer's circles (private groupings of users they follow).
export function useCircles() {
	return useQuery({
		...socialControllerListCirclesOptions(),
	});
}

// Members of one circle (the Circle detail view).
export function useCircleMembers(circleId: string) {
	return useQuery({
		...socialControllerGetCircleMembersOptions({
			path: { circleId },
			query: { pageSize: 50 },
		}),
		enabled: !!circleId,
	});
}

// Refetch the circles list, the following list (carries each user's circleIds),
// and the activity feed (its circle filter may now match more/fewer users).
function invalidateCircleQueries(
	queryClient: ReturnType<typeof useQueryClient>,
) {
	return queryClient.refetchQueries({
		predicate: (query) => {
			const id = (query.queryKey[0] as { _id?: string } | undefined)?._id;
			return (
				id === "socialControllerListCircles" ||
				id === "socialControllerGetCircleMembers" ||
				id === "socialControllerGetFollowing" ||
				id === "socialControllerGetFeed"
			);
		},
	});
}

export function useCreateCircle() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationKey: ["social", "circles", "create"],
		...socialControllerCreateCircleMutation(),
		onSuccess: async () => {
			toast.success("Circle created");
			await queryClient.invalidateQueries({
				queryKey: socialControllerListCirclesQueryKey(),
			});
		},
		onError: (error) => {
			toast.error(
				error instanceof Error ? error.message : "Failed to create circle",
			);
		},
	});
}

export function useRenameCircle() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationKey: ["social", "circles", "rename"],
		...socialControllerRenameCircleMutation(),
		onSuccess: async () => {
			toast.success("Circle renamed");
			await queryClient.invalidateQueries({
				queryKey: socialControllerListCirclesQueryKey(),
			});
		},
		onError: (error) => {
			toast.error(
				error instanceof Error ? error.message : "Failed to rename circle",
			);
		},
	});
}

export function useDeleteCircle() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationKey: ["social", "circles", "delete"],
		...socialControllerDeleteCircleMutation(),
		onSuccess: async () => {
			toast.success("Circle deleted");
			await invalidateCircleQueries(queryClient);
		},
		onError: (error) => {
			toast.error(
				error instanceof Error ? error.message : "Failed to delete circle",
			);
		},
	});
}

export function useAddCircleMember() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationKey: ["social", "circles", "addMember"],
		...socialControllerAddCircleMemberMutation(),
		onSuccess: async () => {
			await invalidateCircleQueries(queryClient);
		},
		onError: (error) => {
			toast.error(
				error instanceof Error ? error.message : "Failed to add to circle",
			);
		},
	});
}

export function useRemoveCircleMember() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationKey: ["social", "circles", "removeMember"],
		...socialControllerRemoveCircleMemberMutation(),
		onSuccess: async () => {
			await invalidateCircleQueries(queryClient);
		},
		onError: (error) => {
			toast.error(
				error instanceof Error ? error.message : "Failed to remove from circle",
			);
		},
	});
}
